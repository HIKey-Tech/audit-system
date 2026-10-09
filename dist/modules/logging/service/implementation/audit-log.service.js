"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogService = exports.AuditLogService = void 0;
// src/modules/logging/service/implementation/audit-log.service.ts
const crypto_1 = require("crypto");
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const audit_log_hash_util_1 = require("../../utility/audit-log-hash.util");
const auditLogUserInclude = {
    user: {
        select: {
            display_name: true,
            first_name: true,
            last_name: true,
            email: true,
        },
    },
};
const logger_util_1 = require("../../../../shared/utils/logger.util");
const request_context_util_1 = require("../../../../shared/utils/request-context.util");
const app_error_1 = require("../../../../shared/errors/app.error");
const tabular_export_util_1 = require("../../../../shared/utils/tabular-export.util");
const logging_enum_1 = require("../../domain/enum/logging.enum");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const logging_response_dto_1 = require("../../dto/response/logging.response.dto");
// Upper bound on events pulled into memory for the per-day and top-N views;
// the headline totals are always exact (grouped in the database).
const SECURITY_SUMMARY_MAX_EVENTS = 20_000;
const SECURITY_TOP_N = 10;
const readJsonObject = (value) => {
    if (!value)
        return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
};
const userLabel = (user) => {
    if (!user)
        return null;
    return user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim() || user.email;
};
class AuditLogService {
    // Serializes sealed writes within this process so the hash chain stays linear:
    // each append reads the previous tip, computes its hash, and inserts before the
    // next one runs. `_lastRowHash` caches the tip (undefined = not yet loaded).
    // ponytail: single-writer assumption (one backend process). If IAMS is ever run
    // multi-instance, move tip resolution to a DB-level sequence lock.
    _chainLock = Promise.resolve();
    _lastRowHash = undefined;
    async log(dto) {
        try {
            const fields = {
                id: (0, crypto_1.randomUUID)(),
                user_id: dto.userId ?? null,
                action: dto.action,
                module: dto.module,
                entity_type: dto.entityType ?? null,
                entity_id: dto.entityId ?? null,
                old_values: dto.oldValues ? JSON.stringify(dto.oldValues) : null,
                new_values: dto.newValues ? JSON.stringify(dto.newValues) : null,
                ip_address: dto.ipAddress ?? (0, request_context_util_1.getRequestContext)()?.ipAddress ?? null,
                user_agent: dto.userAgent ?? (0, request_context_util_1.getRequestContext)()?.userAgent ?? null,
                status: dto.status ?? 'success',
                error_message: dto.errorMessage ?? null,
                duration_ms: dto.durationMs ?? null,
                created_at: new Date(),
            };
            await this._appendSealed(fields);
        }
        catch (err) {
            // Logging must never crash the application
            logger_util_1.logger.error('Failed to persist audit log', { err, dto });
        }
    }
    /** Append one sealed row, serialized against every other append in this process. */
    async _appendSealed(fields) {
        const run = this._chainLock.then(async () => {
            if (this._lastRowHash === undefined) {
                const tip = await prisma_client_1.prisma.audit_Log.findFirst({
                    where: { row_hash: { not: null } },
                    orderBy: { created_at: 'desc' },
                    select: { row_hash: true },
                });
                this._lastRowHash = tip?.row_hash ?? null;
            }
            const prevHash = this._lastRowHash;
            const rowHash = (0, audit_log_hash_util_1.computeRowHash)(fields, prevHash);
            await prisma_client_1.prisma.audit_Log.create({
                data: { ...fields, prev_hash: prevHash, row_hash: rowHash },
            });
            this._lastRowHash = rowHash;
        });
        // Keep the lock chain alive even if this write throws, so the next append still
        // runs; the error is surfaced to the caller (log()) via the await below.
        this._chainLock = run.catch(() => undefined);
        await run;
    }
    /** Walk the sealed chain and report the first break, if any. */
    async verifyChain() {
        const rows = await prisma_client_1.prisma.audit_Log.findMany({
            where: { row_hash: { not: null } },
            select: {
                id: true,
                user_id: true,
                action: true,
                module: true,
                entity_type: true,
                entity_id: true,
                old_values: true,
                new_values: true,
                ip_address: true,
                user_agent: true,
                status: true,
                error_message: true,
                duration_ms: true,
                created_at: true,
                prev_hash: true,
                row_hash: true,
            },
        });
        return (0, audit_log_hash_util_1.verifyLogChain)(rows);
    }
    logAsync(dto) {
        // Fire-and-forget - do not await
        this.log(dto).catch((err) => logger_util_1.logger.error('Async audit log failed', { err }));
    }
    async listLogs(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = this._buildWhere(query);
        const [total, logs] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Log.count({ where }),
            prisma_client_1.prisma.audit_Log.findMany({
                where,
                include: auditLogUserInclude,
                orderBy: { created_at: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            logs: logs.map(logging_response_dto_1.mapAuditLogToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async exportLogs(query, format, actorId) {
        const logs = await prisma_client_1.prisma.audit_Log.findMany({
            where: this._buildWhere(query),
            include: auditLogUserInclude,
            orderBy: { created_at: query.sortOrder },
            take: tabular_export_util_1.EXPORT_MAX_ROWS,
        });
        const rows = logs.map(logging_response_dto_1.mapAuditLogToResponse);
        logger_util_1.logger.info('Audit logs exported', { actorId, format, count: rows.length });
        this.logAsync({
            userId: actorId,
            action: 'logging.export',
            module: 'logging',
            newValues: { format, count: rows.length, filters: query },
        });
        const json = (value) => (value === null || value === undefined ? '' : JSON.stringify(value));
        return (0, tabular_export_util_1.buildTabularExport)(rows, [
            { header: 'Timestamp', value: (r) => r.createdAt },
            { header: 'User', value: (r) => r.userDisplayName },
            { header: 'Module', value: (r) => r.module },
            { header: 'Action', value: (r) => r.action },
            { header: 'Status', value: (r) => r.status },
            { header: 'Entity type', value: (r) => r.entityType },
            { header: 'Entity id', value: (r) => r.entityId },
            { header: 'IP address', value: (r) => r.ipAddress },
            { header: 'Duration (ms)', value: (r) => r.durationMs },
            { header: 'Error', value: (r) => r.errorMessage },
            { header: 'Old values', value: (r) => json(r.oldValues) },
            { header: 'New values', value: (r) => json(r.newValues) },
        ], { baseName: 'audit-logs', format, sheetName: 'Audit logs' });
    }
    async getSecuritySummary(query) {
        const to = new Date();
        const from = new Date(to.getTime() - query.days * 86_400_000);
        const where = {
            module: logging_enum_1.SECURITY_LOG_MODULE,
            created_at: { gte: from },
        };
        const [grouped, events] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Log.groupBy({
                by: ['action'],
                where,
                _count: { _all: true },
                orderBy: { action: 'asc' },
            }),
            prisma_client_1.prisma.audit_Log.findMany({
                where: {
                    ...where,
                    action: { in: [logging_enum_1.SecurityEvent.LoginSucceeded, logging_enum_1.SecurityEvent.LoginFailed, logging_enum_1.SecurityEvent.AccessDenied] },
                },
                select: {
                    action: true,
                    user_id: true,
                    new_values: true,
                    ip_address: true,
                    created_at: true,
                    user: { select: { display_name: true, first_name: true, last_name: true, email: true } },
                },
                orderBy: { created_at: 'desc' },
                take: SECURITY_SUMMARY_MAX_EVENTS + 1,
            }),
        ]);
        const count = (action) => {
            const row = grouped.find((g) => g.action === action);
            return row && typeof row._count === 'object' ? (row._count._all ?? 0) : 0;
        };
        const totals = {
            loginSucceeded: count(logging_enum_1.SecurityEvent.LoginSucceeded),
            loginFailed: count(logging_enum_1.SecurityEvent.LoginFailed),
            mfaFailed: count(logging_enum_1.SecurityEvent.MfaFailed),
            accessDenied: count(logging_enum_1.SecurityEvent.AccessDenied),
            tokenReuseDetected: count(logging_enum_1.SecurityEvent.TokenReuseDetected),
            passwordResets: count(logging_enum_1.SecurityEvent.PasswordResetRequested),
            mfaResets: count(logging_enum_1.SecurityEvent.MfaAdminReset),
        };
        const truncated = events.length > SECURITY_SUMMARY_MAX_EVENTS;
        const sample = events.slice(0, SECURITY_SUMMARY_MAX_EVENTS);
        const byDay = new Map();
        for (let i = query.days - 1; i >= 0; i -= 1) {
            const date = new Date(to.getTime() - i * 86_400_000).toISOString().slice(0, 10);
            byDay.set(date, { date, loginSucceeded: 0, loginFailed: 0, accessDenied: 0 });
        }
        const failed = new Map();
        const denied = new Map();
        for (const event of sample) {
            const day = byDay.get(event.created_at.toISOString().slice(0, 10));
            const values = readJsonObject(event.new_values);
            if (event.action === logging_enum_1.SecurityEvent.LoginSucceeded) {
                if (day)
                    day.loginSucceeded += 1;
            }
            else if (event.action === logging_enum_1.SecurityEvent.LoginFailed) {
                if (day)
                    day.loginFailed += 1;
                const account = String(values.email ?? event.user?.email ?? 'unknown').toLowerCase();
                const entry = failed.get(account) ?? { account, count: 0, lastAt: event.created_at, ips: new Set() };
                entry.count += 1;
                if (event.ip_address)
                    entry.ips.add(event.ip_address);
                failed.set(account, entry);
            }
            else if (event.action === logging_enum_1.SecurityEvent.AccessDenied) {
                if (day)
                    day.accessDenied += 1;
                const key = event.user_id ?? 'anonymous';
                const entry = denied.get(key) ?? {
                    userId: event.user_id,
                    userName: userLabel(event.user),
                    count: 0,
                    lastPath: typeof values.path === 'string' ? values.path : null,
                };
                entry.count += 1;
                denied.set(key, entry);
            }
        }
        return {
            windowDays: query.days,
            from: from.toISOString(),
            to: to.toISOString(),
            totals,
            byDay: Array.from(byDay.values()),
            topFailedAccounts: Array.from(failed.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, SECURITY_TOP_N)
                .map((f) => ({ account: f.account, count: f.count, lastAt: f.lastAt.toISOString(), distinctIps: f.ips.size })),
            topDeniedUsers: Array.from(denied.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, SECURITY_TOP_N),
            truncated,
        };
    }
    async listSecurityEvents(since, limit) {
        const logs = await prisma_client_1.prisma.audit_Log.findMany({
            where: { module: logging_enum_1.SECURITY_LOG_MODULE, created_at: { gte: since } },
            include: auditLogUserInclude,
            orderBy: { created_at: 'desc' },
            take: limit,
        });
        return logs.map(logging_response_dto_1.mapAuditLogToResponse);
    }
    async getLogById(id) {
        const log = await prisma_client_1.prisma.audit_Log.findUnique({
            where: { id },
            include: auditLogUserInclude,
        });
        if (!log) {
            throw app_error_1.AppError.notFound('Audit log');
        }
        return (0, logging_response_dto_1.mapAuditLogToResponse)(log);
    }
    async getDistinctModules() {
        const modules = await prisma_client_1.prisma.audit_Log.findMany({
            distinct: ['module'],
            select: { module: true },
            orderBy: { module: 'asc' },
        });
        return modules.map((entry) => entry.module);
    }
    async getLogSummary(query) {
        const where = this._buildDateWhere(query);
        const grouped = await prisma_client_1.prisma.audit_Log.groupBy({
            by: ['module', 'status'],
            where,
            _count: { _all: true },
            orderBy: { module: 'asc' },
        });
        const summaryByModule = new Map();
        grouped.forEach((row) => {
            const current = summaryByModule.get(row.module) ?? {
                module: row.module,
                totalActions: 0,
                successCount: 0,
                failureCount: 0,
            };
            const count = row._count._all;
            current.totalActions += count;
            if (row.status === 'success') {
                current.successCount += count;
            }
            if (row.status === 'failure') {
                current.failureCount += count;
            }
            summaryByModule.set(row.module, current);
        });
        return Array.from(summaryByModule.values());
    }
    _buildWhere(query) {
        return {
            ...(query.userId ? { user_id: query.userId } : {}),
            ...(query.module ? { module: query.module } : {}),
            ...(query.entityType ? { entity_type: query.entityType } : {}),
            ...(query.entityId ? { entity_id: query.entityId } : {}),
            ...(query.action ? { action: { contains: query.action } } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.hasChanges
                ? {
                    entity_type: { not: null },
                    OR: [{ old_values: { not: null } }, { new_values: { not: null } }],
                    // Sign-in/out and other security events are not data changes.
                    AND: [{ module: { not: logging_enum_1.SECURITY_LOG_MODULE } }],
                }
                : {}),
            ...this._buildDateWhere(query),
        };
    }
    _buildDateWhere(query) {
        if (!query.dateFrom && !query.dateTo) {
            return {};
        }
        return {
            created_at: {
                ...(query.dateFrom ? { gte: query.dateFrom } : {}),
                ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
        };
    }
}
exports.AuditLogService = AuditLogService;
// Singleton for use across the application
exports.auditLogService = new AuditLogService();
//# sourceMappingURL=audit-log.service.js.map