"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinuousMonitoringService = exports.MONITORING_CHECKS = exports.MONITORING_CONFIG_KEY = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_config_1 = require("../../../../../shared/config/app.config");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const app_error_1 = require("../../../../../shared/errors/app.error");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
const analytics_response_dto_1 = require("../../../analytics/dto/response/analytics.response.dto");
const system_audit_utility_1 = require("../../../utility/system-audit.utility");
exports.MONITORING_CONFIG_KEY = 'continuous_monitoring';
const TREND_DAYS = 30;
const TREND_MAX_ROWS = 20_000;
const DASHBOARD_WINDOW_DAYS = 7;
/**
 * The scheduler acts as this account: it may read IMOC and see every run, and
 * its runs are recorded with no human creator.
 */
const MONITORING_ACTOR = {
    id: 'system:continuous-monitoring',
    roles: [],
    permissions: ['imoc:read', 'engagement:read_all'],
};
const always = () => ({ connected: true, note: null });
exports.MONITORING_CHECKS = [
    {
        key: 'iams_access',
        label: 'IAMS user access & segregation of duties',
        description: 'Every IAMS account: conflicting permissions, dormant and privileged accounts, and sign-in without MFA.',
        analysisType: system_audit_enum_1.AnalysisType.AccessListing,
        source: system_audit_enum_1.AnalysisSource.Iams,
        connection: always,
    },
    {
        key: 'iams_security_events',
        label: 'IAMS sign-in & access anomalies',
        description: 'Failed sign-ins, brute-force and password-spray patterns, denied access, and privileged activity out of hours.',
        analysisType: system_audit_enum_1.AnalysisType.SecurityEventLog,
        source: system_audit_enum_1.AnalysisSource.Iams,
        lookback: 'securityEventLookbackDays',
        connection: always,
    },
    {
        key: 'entra_access',
        label: 'Entra ID accounts & group access',
        description: 'Directory accounts and group memberships, cross-checked against the IAMS staff record.',
        analysisType: system_audit_enum_1.AnalysisType.AccessListing,
        source: system_audit_enum_1.AnalysisSource.EntraId,
        connection: () => app_config_1.config.directorySync.enabled
            ? { connected: true, note: null }
            : { connected: false, note: 'Entra ID directory sync is not enabled (DIRECTORY_SYNC_ENABLED)' },
    },
    {
        key: 'imoc_incidents',
        label: 'IMOC incident SLA',
        description: 'IMOC tickets opened in the look-back window: SLA breaches and aged open incidents.',
        analysisType: system_audit_enum_1.AnalysisType.IncidentLog,
        source: system_audit_enum_1.AnalysisSource.Imoc,
        lookback: 'incidentLookbackDays',
        connection: () => app_config_1.config.imoc.enabled
            ? { connected: true, note: null }
            : { connected: false, note: 'The IMOC integration is not enabled (IMOC_ENABLED)' },
    },
];
const DEFAULT_CONFIG = {
    enabled: true,
    checks: Object.fromEntries(exports.MONITORING_CHECKS.map((c) => [c.key, true])),
    securityEventLookbackDays: 1,
    incidentLookbackDays: 7,
    notifyOnSeverity: system_audit_enum_1.ExceptionSeverity.High,
};
const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};
class ContinuousMonitoringService {
    analyticsService;
    userService;
    auditLogService;
    systemLogService;
    riskMonitoringService;
    systemConfigService;
    notificationQueue;
    constructor(analyticsService, userService, auditLogService, systemLogService, riskMonitoringService, systemConfigService, notificationQueue) {
        this.analyticsService = analyticsService;
        this.userService = userService;
        this.auditLogService = auditLogService;
        this.systemLogService = systemLogService;
        this.riskMonitoringService = riskMonitoringService;
        this.systemConfigService = systemConfigService;
        this.notificationQueue = notificationQueue;
    }
    async runScheduledChecks() {
        const cfg = await this._config();
        const result = { ran: [], skipped: [], failed: [] };
        if (!cfg.enabled) {
            exports.MONITORING_CHECKS.forEach((c) => result.skipped.push({ check: c.key, reason: 'Continuous monitoring is switched off' }));
            return result;
        }
        for (const check of exports.MONITORING_CHECKS) {
            const alreadyRan = await prisma_client_1.prisma.system_Audit_Run.count({
                where: {
                    trigger: system_audit_enum_1.RunTrigger.Scheduled,
                    analysis_type: check.analysisType,
                    source: check.source,
                    created_at: { gte: startOfToday() },
                },
            });
            if (alreadyRan > 0) {
                result.skipped.push({ check: check.key, reason: 'Already ran today' });
                continue;
            }
            await this._runCheck(check, cfg, MONITORING_ACTOR, system_audit_enum_1.RunTrigger.Scheduled, result);
        }
        logger_util_1.logger.info('Continuous monitoring completed', {
            ran: result.ran.length,
            skipped: result.skipped.length,
            failed: result.failed.length,
        });
        return result;
    }
    async runChecksNow(actor) {
        const cfg = await this._config();
        const result = { ran: [], skipped: [], failed: [] };
        for (const check of exports.MONITORING_CHECKS) {
            await this._runCheck(check, cfg, actor, system_audit_enum_1.RunTrigger.Manual, result);
        }
        logger_util_1.logger.info('Continuous monitoring run on demand', { actorId: actor.id, ran: result.ran.length });
        return result;
    }
    async getDashboard(actor) {
        const cfg = await this._config();
        const checks = await Promise.all(exports.MONITORING_CHECKS.map(async (check) => {
            const { connected, note } = check.connection();
            const { runs } = await this.analyticsService.listRuns({ page: 1, pageSize: 1, analysisType: check.analysisType, source: check.source }, actor);
            return {
                key: check.key,
                label: check.label,
                description: check.description,
                analysisType: check.analysisType,
                source: check.source,
                enabled: cfg.enabled && cfg.checks[check.key] !== false,
                connected,
                connectionNote: note,
                lastRun: runs[0] ?? null,
            };
        }));
        const lastRunIds = checks.map((c) => c.lastRun?.id).filter((id) => Boolean(id));
        const openGrouped = lastRunIds.length
            ? await prisma_client_1.prisma.system_Audit_Exception.groupBy({
                by: ['severity'],
                where: { run_id: { in: lastRunIds }, disposition: system_audit_enum_1.ExceptionDisposition.Open },
                _count: { _all: true },
            })
            : [];
        const openExceptions = (0, analytics_response_dto_1.emptySeverityCounts)();
        for (const row of openGrouped) {
            if (row.severity in openExceptions)
                openExceptions[row.severity] += row._count._all;
        }
        const latestEntries = await Promise.all(Object.values(system_audit_enum_1.AnalysisType).map(async (type) => {
            const { runs } = await this.analyticsService.listRuns({ page: 1, pageSize: 1, analysisType: type }, actor);
            return [type, runs[0] ?? null];
        }));
        const canReadLogs = actor.isSuperAdmin || actor.permissions.includes('log:read');
        const [trend, security, systemExceptions, emergingRisks] = await Promise.all([
            this._exceptionTrend(),
            canReadLogs ? this.auditLogService.getSecuritySummary({ days: DASHBOARD_WINDOW_DAYS }) : Promise.resolve(null),
            canReadLogs ? this.systemLogService.countRecent(DASHBOARD_WINDOW_DAYS) : Promise.resolve(null),
            this._emergingRisks(actor),
        ]);
        return {
            generatedAt: new Date().toISOString(),
            config: cfg,
            checks,
            openExceptions,
            exceptionTrend: trend,
            latestByType: Object.fromEntries(latestEntries),
            security: security
                ? {
                    windowDays: security.windowDays,
                    loginSucceeded: security.totals.loginSucceeded,
                    loginFailed: security.totals.loginFailed,
                    mfaFailed: security.totals.mfaFailed,
                    accessDenied: security.totals.accessDenied,
                    tokenReuseDetected: security.totals.tokenReuseDetected,
                }
                : null,
            systemExceptions: systemExceptions ? { windowDays: DASHBOARD_WINDOW_DAYS, ...systemExceptions } : null,
            emergingRisks,
        };
    }
    // ── internals ───────────────────────────────────────────────
    async _runCheck(check, cfg, actor, trigger, result) {
        if (cfg.checks[check.key] === false) {
            result.skipped.push({ check: check.key, reason: 'Check is switched off' });
            return;
        }
        const { connected, note } = check.connection();
        if (!connected) {
            result.skipped.push({ check: check.key, reason: note ?? 'Source not connected' });
            return;
        }
        try {
            const run = await this.analyticsService.runLiveAnalysis({
                analysisType: check.analysisType,
                source: check.source,
                days: check.lookback ? cfg[check.lookback] : 30,
            }, actor, trigger);
            result.ran.push({ check: check.key, runId: run.id, reference: run.reference, exceptions: run.exceptionCount });
            if (trigger === system_audit_enum_1.RunTrigger.Scheduled)
                await this._notify(run, cfg);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            result.failed.push({ check: check.key, error: message });
            logger_util_1.logger.warn('Continuous monitoring check failed', { check: check.key, error: message });
        }
    }
    /** Tell system-audit administrators about serious new exceptions from a scheduled run. */
    async _notify(run, cfg) {
        const threshold = system_audit_utility_1.SEVERITY_RANK[cfg.notifyOnSeverity] ?? system_audit_utility_1.SEVERITY_RANK[system_audit_enum_1.ExceptionSeverity.High];
        const serious = Object.entries(run.severityCounts)
            .filter(([severity]) => system_audit_utility_1.SEVERITY_RANK[severity] >= threshold)
            .reduce((n, [, count]) => n + count, 0);
        if (serious === 0)
            return;
        const recipients = (await this.userService.listAccessEntitlements()).filter((u) => u.isActive && (u.isSuperAdmin || u.permissions.includes('sysaudit:admin')));
        for (const user of recipients) {
            await this.notificationQueue.enqueueSafe('in_app', {
                userId: user.id,
                title: `Continuous monitoring: ${serious} exception(s) need review`,
                body: `${run.title} (${run.reference}) found ${serious} exception(s) at ${cfg.notifyOnSeverity} severity or above.`,
                type: 'warning',
                referenceType: 'system_audit_run',
                referenceId: run.id,
            });
        }
    }
    async _config() {
        try {
            const stored = await this.systemConfigService.getConfig(exports.MONITORING_CONFIG_KEY);
            const parsed = (0, system_audit_utility_1.parseJson)(stored.value, {});
            return {
                ...DEFAULT_CONFIG,
                ...parsed,
                checks: { ...DEFAULT_CONFIG.checks, ...(parsed.checks ?? {}) },
            };
        }
        catch (err) {
            if (err instanceof app_error_1.AppError && err.statusCode === 404)
                return DEFAULT_CONFIG;
            throw err;
        }
    }
    async _exceptionTrend() {
        // Day buckets are UTC dates, matching how the rows' timestamps are keyed.
        const todayUtc = new Date();
        todayUtc.setUTCHours(0, 0, 0, 0);
        const since = new Date(todayUtc.getTime() - (TREND_DAYS - 1) * 86_400_000);
        const rows = await prisma_client_1.prisma.system_Audit_Exception.findMany({
            where: { created_at: { gte: since } },
            select: { severity: true, created_at: true },
            take: TREND_MAX_ROWS,
        });
        const days = new Map();
        for (let i = 0; i < TREND_DAYS; i += 1) {
            const key = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
            days.set(key, { date: key, criticalHigh: 0, mediumLow: 0 });
        }
        for (const row of rows) {
            const day = days.get(row.created_at.toISOString().slice(0, 10));
            if (!day)
                continue;
            if (row.severity === system_audit_enum_1.ExceptionSeverity.Critical || row.severity === system_audit_enum_1.ExceptionSeverity.High)
                day.criticalHigh += 1;
            else
                day.mediumLow += 1;
        }
        return Array.from(days.values());
    }
    async _emergingRisks(actor) {
        try {
            return await this.riskMonitoringService.getEmergingRisks({ days: 90, limit: 8 }, { id: actor.id, roles: actor.roles, permissions: actor.permissions });
        }
        catch (err) {
            // Viewers without risk-monitoring access still get the rest of the dashboard.
            if (err instanceof app_error_1.AppError && err.statusCode === 403)
                return [];
            throw err;
        }
    }
}
exports.ContinuousMonitoringService = ContinuousMonitoringService;
//# sourceMappingURL=monitoring.service.js.map