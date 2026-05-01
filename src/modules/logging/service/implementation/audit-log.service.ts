// src/modules/logging/service/implementation/audit-log.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
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
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      await prisma.audit_Log.create({
        data: {
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
        },
      });
    } catch (err) {
      // Logging must never crash the application
      logger.error('Failed to persist audit log', { err, dto });
    }
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
