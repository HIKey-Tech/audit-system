import { prisma } from '../../../../../shared/prisma/prisma.client';
import { config } from '../../../../../shared/config/app.config';
import { logger } from '../../../../../shared/utils/logger.util';
import { AppError } from '../../../../../shared/errors/app.error';
import { IAuditLogService, ISystemLogService } from '../../../../logging/service/interface/audit-log.service.interface';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IMonitoringService as IRiskMonitoringService } from '../../../../risk/monitoring/service/interface/monitoring.service.interface';
import { ISystemConfigService } from '../../../../settings/service/interface/system-config.service.interface';
import { INotificationQueueService } from '../../../../messaging/service/interface/notification-queue.service.interface';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import {
  AnalysisSource,
  AnalysisType,
  ExceptionDisposition,
  ExceptionSeverity,
  RunTrigger,
} from '../../../domain/enum/system-audit.enum';
import { ISystemAuditAnalyticsService } from '../../../analytics/service/interface/analytics.service.interface';
import { RunResponseDto, emptySeverityCounts } from '../../../analytics/dto/response/analytics.response.dto';
import { SEVERITY_RANK, parseJson } from '../../../utility/system-audit.utility';
import {
  MonitoringCheckDto,
  MonitoringConfigDto,
  MonitoringDashboardDto,
  MonitoringRunResultDto,
} from '../../dto/response/monitoring.response.dto';
import { IContinuousMonitoringService } from '../interface/monitoring.service.interface';

export const MONITORING_CONFIG_KEY = 'continuous_monitoring';
const TREND_DAYS = 30;
const TREND_MAX_ROWS = 20_000;
const DASHBOARD_WINDOW_DAYS = 7;

/**
 * The scheduler acts as this account: it may read IMOC and see every run, and
 * its runs are recorded with no human creator.
 */
const MONITORING_ACTOR: SystemAuditActor = {
  id: 'system:continuous-monitoring',
  roles: [],
  permissions: ['imoc:read', 'engagement:read_all'],
};

interface CheckDefinition {
  key: string;
  label: string;
  description: string;
  analysisType: AnalysisType;
  source: AnalysisSource;
  lookback?: 'securityEventLookbackDays' | 'incidentLookbackDays';
  connection: () => { connected: boolean; note: string | null };
}

const always = () => ({ connected: true, note: null });

export const MONITORING_CHECKS: CheckDefinition[] = [
  {
    key: 'iams_access',
    label: 'IAMS user access & segregation of duties',
    description: 'Every IAMS account: conflicting permissions, dormant and privileged accounts, and sign-in without MFA.',
    analysisType: AnalysisType.AccessListing,
    source: AnalysisSource.Iams,
    connection: always,
  },
  {
    key: 'iams_security_events',
    label: 'IAMS sign-in & access anomalies',
    description: 'Failed sign-ins, brute-force and password-spray patterns, denied access, and privileged activity out of hours.',
    analysisType: AnalysisType.SecurityEventLog,
    source: AnalysisSource.Iams,
    lookback: 'securityEventLookbackDays',
    connection: always,
  },
  {
    key: 'entra_access',
    label: 'Entra ID accounts & group access',
    description: 'Directory accounts and group memberships, cross-checked against the IAMS staff record.',
    analysisType: AnalysisType.AccessListing,
    source: AnalysisSource.EntraId,
    connection: () =>
      config.directorySync.enabled
        ? { connected: true, note: null }
        : { connected: false, note: 'Entra ID directory sync is not enabled (DIRECTORY_SYNC_ENABLED)' },
  },
  {
    key: 'imoc_incidents',
    label: 'IMOC incident SLA',
    description: 'IMOC tickets opened in the look-back window: SLA breaches and aged open incidents.',
    analysisType: AnalysisType.IncidentLog,
    source: AnalysisSource.Imoc,
    lookback: 'incidentLookbackDays',
    connection: () =>
      config.imoc.enabled
        ? { connected: true, note: null }
        : { connected: false, note: 'The IMOC integration is not enabled (IMOC_ENABLED)' },
  },
];

const DEFAULT_CONFIG: MonitoringConfigDto = {
  enabled: true,
  checks: Object.fromEntries(MONITORING_CHECKS.map((c) => [c.key, true])),
  securityEventLookbackDays: 1,
  incidentLookbackDays: 7,
  notifyOnSeverity: ExceptionSeverity.High,
};

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export class ContinuousMonitoringService implements IContinuousMonitoringService {
  constructor(
    private readonly analyticsService: ISystemAuditAnalyticsService,
    private readonly userService: IUserService,
    private readonly auditLogService: IAuditLogService,
    private readonly systemLogService: ISystemLogService,
    private readonly riskMonitoringService: IRiskMonitoringService,
    private readonly systemConfigService: ISystemConfigService,
    private readonly notificationQueue: INotificationQueueService,
  ) {}

  async runScheduledChecks(): Promise<MonitoringRunResultDto> {
    const cfg = await this._config();
    const result: MonitoringRunResultDto = { ran: [], skipped: [], failed: [] };
    if (!cfg.enabled) {
      MONITORING_CHECKS.forEach((c) => result.skipped.push({ check: c.key, reason: 'Continuous monitoring is switched off' }));
      return result;
    }

    for (const check of MONITORING_CHECKS) {
      const alreadyRan = await prisma.system_Audit_Run.count({
        where: {
          trigger: RunTrigger.Scheduled,
          analysis_type: check.analysisType,
          source: check.source,
          created_at: { gte: startOfToday() },
        },
      });
      if (alreadyRan > 0) {
        result.skipped.push({ check: check.key, reason: 'Already ran today' });
        continue;
      }
      await this._runCheck(check, cfg, MONITORING_ACTOR, RunTrigger.Scheduled, result);
    }

    logger.info('Continuous monitoring completed', {
      ran: result.ran.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
    });
    return result;
  }

  async runChecksNow(actor: SystemAuditActor): Promise<MonitoringRunResultDto> {
    const cfg = await this._config();
    const result: MonitoringRunResultDto = { ran: [], skipped: [], failed: [] };
    for (const check of MONITORING_CHECKS) {
      await this._runCheck(check, cfg, actor, RunTrigger.Manual, result);
    }
    logger.info('Continuous monitoring run on demand', { actorId: actor.id, ran: result.ran.length });
    return result;
  }

  async getDashboard(actor: SystemAuditActor): Promise<MonitoringDashboardDto> {
    const cfg = await this._config();

    const checks: MonitoringCheckDto[] = await Promise.all(
      MONITORING_CHECKS.map(async (check) => {
        const { connected, note } = check.connection();
        const { runs } = await this.analyticsService.listRuns(
          { page: 1, pageSize: 1, analysisType: check.analysisType, source: check.source },
          actor,
        );
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
      }),
    );

    const lastRunIds = checks.map((c) => c.lastRun?.id).filter((id): id is string => Boolean(id));
    const openGrouped = lastRunIds.length
      ? await prisma.system_Audit_Exception.groupBy({
          by: ['severity'],
          where: { run_id: { in: lastRunIds }, disposition: ExceptionDisposition.Open },
          _count: { _all: true },
        })
      : [];
    const openExceptions = emptySeverityCounts();
    for (const row of openGrouped) {
      if (row.severity in openExceptions) openExceptions[row.severity as keyof typeof openExceptions] += row._count._all;
    }

    const latestEntries = await Promise.all(
      Object.values(AnalysisType).map(async (type) => {
        const { runs } = await this.analyticsService.listRuns({ page: 1, pageSize: 1, analysisType: type }, actor);
        return [type, runs[0] ?? null] as [string, RunResponseDto | null];
      }),
    );

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

  private async _runCheck(
    check: CheckDefinition,
    cfg: MonitoringConfigDto,
    actor: SystemAuditActor,
    trigger: RunTrigger,
    result: MonitoringRunResultDto,
  ): Promise<void> {
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
      const run = await this.analyticsService.runLiveAnalysis(
        {
          analysisType: check.analysisType,
          source: check.source as AnalysisSource.Iams | AnalysisSource.EntraId | AnalysisSource.Imoc,
          days: check.lookback ? cfg[check.lookback] : 30,
        },
        actor,
        trigger,
      );
      result.ran.push({ check: check.key, runId: run.id, reference: run.reference, exceptions: run.exceptionCount });
      if (trigger === RunTrigger.Scheduled) await this._notify(run, cfg);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ check: check.key, error: message });
      logger.warn('Continuous monitoring check failed', { check: check.key, error: message });
    }
  }

  /** Tell system-audit administrators about serious new exceptions from a scheduled run. */
  private async _notify(run: RunResponseDto, cfg: MonitoringConfigDto): Promise<void> {
    const threshold = SEVERITY_RANK[cfg.notifyOnSeverity as ExceptionSeverity] ?? SEVERITY_RANK[ExceptionSeverity.High];
    const serious = (Object.entries(run.severityCounts) as Array<[ExceptionSeverity, number]>)
      .filter(([severity]) => SEVERITY_RANK[severity] >= threshold)
      .reduce((n, [, count]) => n + count, 0);
    if (serious === 0) return;

    const recipients = (await this.userService.listAccessEntitlements()).filter(
      (u) => u.isActive && (u.isSuperAdmin || u.permissions.includes('sysaudit:admin')),
    );
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

  private async _config(): Promise<MonitoringConfigDto> {
    try {
      const stored = await this.systemConfigService.getConfig(MONITORING_CONFIG_KEY);
      const parsed = parseJson<Partial<MonitoringConfigDto>>(stored.value, {});
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        checks: { ...DEFAULT_CONFIG.checks, ...(parsed.checks ?? {}) },
      };
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 404) return DEFAULT_CONFIG;
      throw err;
    }
  }

  private async _exceptionTrend(): Promise<MonitoringDashboardDto['exceptionTrend']> {
    // Day buckets are UTC dates, matching how the rows' timestamps are keyed.
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const since = new Date(todayUtc.getTime() - (TREND_DAYS - 1) * 86_400_000);
    const rows = await prisma.system_Audit_Exception.findMany({
      where: { created_at: { gte: since } },
      select: { severity: true, created_at: true },
      take: TREND_MAX_ROWS,
    });
    const days = new Map<string, { date: string; criticalHigh: number; mediumLow: number }>();
    for (let i = 0; i < TREND_DAYS; i += 1) {
      const key = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      days.set(key, { date: key, criticalHigh: 0, mediumLow: 0 });
    }
    for (const row of rows) {
      const day = days.get(row.created_at.toISOString().slice(0, 10));
      if (!day) continue;
      if (row.severity === ExceptionSeverity.Critical || row.severity === ExceptionSeverity.High) day.criticalHigh += 1;
      else day.mediumLow += 1;
    }
    return Array.from(days.values());
  }

  private async _emergingRisks(actor: SystemAuditActor): Promise<MonitoringDashboardDto['emergingRisks']> {
    try {
      return await this.riskMonitoringService.getEmergingRisks(
        { days: 90, limit: 8 },
        { id: actor.id, roles: actor.roles, permissions: actor.permissions },
      );
    } catch (err) {
      // Viewers without risk-monitoring access still get the rest of the dashboard.
      if (err instanceof AppError && err.statusCode === 403) return [];
      throw err;
    }
  }
}
