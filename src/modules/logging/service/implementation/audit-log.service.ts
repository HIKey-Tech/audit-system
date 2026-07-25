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
import { AppError } from '../../../../shared/errors/app.error';
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
} from '../../dto/request/logging.request.dto';
import {
  AuditLogResponseDto,
  AuditLogSummaryDto,
  mapAuditLogToResponse,
} from '../../dto/response/logging.response.dto';

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
        ip_address: dto.ipAddress ?? null,
        user_agent: dto.userAgent ?? null,
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
