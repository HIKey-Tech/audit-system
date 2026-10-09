// src/modules/logging/service/implementation/audit-log.service.ts
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import {
  ChainVerificationResult,
  SealableLogFields,
  SealedLogRow,
  computeRowHash,
  verifyLogChain,
} from '../../utility/audit-log-hash.util';

const auditLogUserInclude = {
  user: {
    select: {
      display_name: true,
      first_name: true,
      last_name: true,
      email: true,
    },
  },
} as const;
import { logger } from '../../../../shared/utils/logger.util';
import { getRequestContext } from '../../../../shared/utils/request-context.util';
import { AppError } from '../../../../shared/errors/app.error';
import {
  EXPORT_MAX_ROWS,
  ExportFormat,
  TabularExportFile,
  buildTabularExport,
} from '../../../../shared/utils/tabular-export.util';
import { SECURITY_LOG_MODULE, SecurityEvent } from '../../domain/enum/logging.enum';
import {
  PaginationMeta,
  parsePagination,
  buildPaginationMeta,
} from '../../../../shared/types/api-response.type';
import {
  IAuditLogService,
  CreateAuditLogDto,
} from '../interface/audit-log.service.interface';
import {
  AuditLogListQueryDto,
  AuditLogSummaryQueryDto,
  SecuritySummaryQueryDto,
} from '../../dto/request/logging.request.dto';
import {
  AuditLogResponseDto,
  AuditLogSummaryDto,
  SecurityEventCountsDto,
  SecuritySummaryDto,
  mapAuditLogToResponse,
} from '../../dto/response/logging.response.dto';

// Upper bound on events pulled into memory for the per-day and top-N views;
// the headline totals are always exact (grouped in the database).
const SECURITY_SUMMARY_MAX_EVENTS = 20_000;
const SECURITY_TOP_N = 10;

const readJsonObject = (value: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const userLabel = (
  user: { display_name: string | null; first_name: string; last_name: string; email: string } | null,
): string | null => {
  if (!user) return null;
  return user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim() || user.email;
};

export class AuditLogService implements IAuditLogService {
  // Serializes sealed writes within this process so the hash chain stays linear:
  // each append reads the previous tip, computes its hash, and inserts before the
  // next one runs. `_lastRowHash` caches the tip (undefined = not yet loaded).
  // ponytail: single-writer assumption (one backend process). If IAMS is ever run
  // multi-instance, move tip resolution to a DB-level sequence lock.
  private _chainLock: Promise<unknown> = Promise.resolve();
  private _lastRowHash: string | null | undefined = undefined;

  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      const fields: SealableLogFields = {
        id: randomUUID(),
        user_id: dto.userId ?? null,
        action: dto.action,
        module: dto.module,
        entity_type: dto.entityType ?? null,
        entity_id: dto.entityId ?? null,
        old_values: dto.oldValues ? JSON.stringify(dto.oldValues) : null,
        new_values: dto.newValues ? JSON.stringify(dto.newValues) : null,
        ip_address: dto.ipAddress ?? getRequestContext()?.ipAddress ?? null,
        user_agent: dto.userAgent ?? getRequestContext()?.userAgent ?? null,
        status: dto.status ?? 'success',
        error_message: dto.errorMessage ?? null,
        duration_ms: dto.durationMs ?? null,
        created_at: new Date(),
      };
      await this._appendSealed(fields);
    } catch (err) {
      // Logging must never crash the application
      logger.error('Failed to persist audit log', { err, dto });
    }
  }

  /** Append one sealed row, serialized against every other append in this process. */
  private async _appendSealed(fields: SealableLogFields): Promise<void> {
    const run = this._chainLock.then(async () => {
      if (this._lastRowHash === undefined) {
        const tip = await prisma.audit_Log.findFirst({
          where: { row_hash: { not: null } },
          orderBy: { created_at: 'desc' },
          select: { row_hash: true },
        });
        this._lastRowHash = tip?.row_hash ?? null;
      }
      const prevHash = this._lastRowHash;
      const rowHash = computeRowHash(fields, prevHash);
      await prisma.audit_Log.create({
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
  async verifyChain(): Promise<ChainVerificationResult> {
    const rows = await prisma.audit_Log.findMany({
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
    return verifyLogChain(rows as SealedLogRow[]);
  }

  logAsync(dto: CreateAuditLogDto): void {
    // Fire-and-forget - do not await
    this.log(dto).catch((err) =>
      logger.error('Async audit log failed', { err }),
    );
  }

  async listLogs(
    query: AuditLogListQueryDto,
  ): Promise<{ logs: AuditLogResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this._buildWhere(query);

    const [total, logs] = await prisma.$transaction([
      prisma.audit_Log.count({ where }),
      prisma.audit_Log.findMany({
        where,
        include: auditLogUserInclude,
        orderBy: { created_at: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      logs: logs.map(mapAuditLogToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async exportLogs(query: AuditLogListQueryDto, format: ExportFormat, actorId: string): Promise<TabularExportFile> {
    const logs = await prisma.audit_Log.findMany({
      where: this._buildWhere(query),
      include: auditLogUserInclude,
      orderBy: { created_at: query.sortOrder },
      take: EXPORT_MAX_ROWS,
    });
    const rows = logs.map(mapAuditLogToResponse);

    logger.info('Audit logs exported', { actorId, format, count: rows.length });
    this.logAsync({
      userId: actorId,
      action: 'logging.export',
      module: 'logging',
      newValues: { format, count: rows.length, filters: query },
    });

    const json = (value: unknown): string => (value === null || value === undefined ? '' : JSON.stringify(value));
    return buildTabularExport(
      rows,
      [
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
      ],
      { baseName: 'audit-logs', format, sheetName: 'Audit logs' },
    );
  }

  async getSecuritySummary(query: SecuritySummaryQueryDto): Promise<SecuritySummaryDto> {
    const to = new Date();
    const from = new Date(to.getTime() - query.days * 86_400_000);
    const where: Prisma.Audit_LogWhereInput = {
      module: SECURITY_LOG_MODULE,
      created_at: { gte: from },
    };

    const [grouped, events] = await prisma.$transaction([
      prisma.audit_Log.groupBy({
        by: ['action'],
        where,
        _count: { _all: true },
        orderBy: { action: 'asc' },
      }),
      prisma.audit_Log.findMany({
        where: {
          ...where,
          action: { in: [SecurityEvent.LoginSucceeded, SecurityEvent.LoginFailed, SecurityEvent.AccessDenied] },
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

    const count = (action: SecurityEvent): number => {
      const row = grouped.find((g) => g.action === action);
      return row && typeof row._count === 'object' ? (row._count._all ?? 0) : 0;
    };
    const totals: SecurityEventCountsDto = {
      loginSucceeded: count(SecurityEvent.LoginSucceeded),
      loginFailed: count(SecurityEvent.LoginFailed),
      mfaFailed: count(SecurityEvent.MfaFailed),
      accessDenied: count(SecurityEvent.AccessDenied),
      tokenReuseDetected: count(SecurityEvent.TokenReuseDetected),
      passwordResets: count(SecurityEvent.PasswordResetRequested),
      mfaResets: count(SecurityEvent.MfaAdminReset),
    };

    const truncated = events.length > SECURITY_SUMMARY_MAX_EVENTS;
    const sample = events.slice(0, SECURITY_SUMMARY_MAX_EVENTS);

    const byDay = new Map<string, { date: string; loginSucceeded: number; loginFailed: number; accessDenied: number }>();
    for (let i = query.days - 1; i >= 0; i -= 1) {
      const date = new Date(to.getTime() - i * 86_400_000).toISOString().slice(0, 10);
      byDay.set(date, { date, loginSucceeded: 0, loginFailed: 0, accessDenied: 0 });
    }

    const failed = new Map<string, { account: string; count: number; lastAt: Date; ips: Set<string> }>();
    const denied = new Map<string, { userId: string | null; userName: string | null; count: number; lastPath: string | null }>();

    for (const event of sample) {
      const day = byDay.get(event.created_at.toISOString().slice(0, 10));
      const values = readJsonObject(event.new_values);
      if (event.action === SecurityEvent.LoginSucceeded) {
        if (day) day.loginSucceeded += 1;
      } else if (event.action === SecurityEvent.LoginFailed) {
        if (day) day.loginFailed += 1;
        const account = String(values.email ?? event.user?.email ?? 'unknown').toLowerCase();
        const entry = failed.get(account) ?? { account, count: 0, lastAt: event.created_at, ips: new Set<string>() };
        entry.count += 1;
        if (event.ip_address) entry.ips.add(event.ip_address);
        failed.set(account, entry);
      } else if (event.action === SecurityEvent.AccessDenied) {
        if (day) day.accessDenied += 1;
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

  async listSecurityEvents(since: Date, limit: number): Promise<AuditLogResponseDto[]> {
    const logs = await prisma.audit_Log.findMany({
      where: { module: SECURITY_LOG_MODULE, created_at: { gte: since } },
      include: auditLogUserInclude,
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return logs.map(mapAuditLogToResponse);
  }

  async getLogById(id: string): Promise<AuditLogResponseDto> {
    const log = await prisma.audit_Log.findUnique({
      where: { id },
      include: auditLogUserInclude,
    });

    if (!log) {
      throw AppError.notFound('Audit log');
    }

    return mapAuditLogToResponse(log);
  }

  async getDistinctModules(): Promise<string[]> {
    const modules = await prisma.audit_Log.findMany({
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' },
    });

    return modules.map((entry) => entry.module);
  }

  async getLogSummary(query: AuditLogSummaryQueryDto): Promise<AuditLogSummaryDto[]> {
    const where = this._buildDateWhere(query);

    const grouped = await prisma.audit_Log.groupBy({
      by: ['module', 'status'],
      where,
      _count: { _all: true },
      orderBy: { module: 'asc' },
    });

    const summaryByModule = new Map<string, AuditLogSummaryDto>();

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

  private _buildWhere(query: AuditLogListQueryDto): Prisma.Audit_LogWhereInput {
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
            AND: [{ module: { not: SECURITY_LOG_MODULE } }],
          }
        : {}),
      ...this._buildDateWhere(query),
    };
  }

  private _buildDateWhere(
    query: AuditLogSummaryQueryDto,
  ): Prisma.Audit_LogWhereInput {
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

// Singleton for use across the application
export const auditLogService = new AuditLogService();
