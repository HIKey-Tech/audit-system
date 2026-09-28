import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../shared/types/api-response.type';
import { SystemLogListQueryDto } from '../../dto/request/logging.request.dto';
import { SystemLogResponseDto, mapSystemLogToResponse } from '../../dto/response/logging.response.dto';
import { ISystemLogService } from '../interface/audit-log.service.interface';

export class SystemLogService implements ISystemLogService {
  async listSystemLogs(
    query: SystemLogListQueryDto,
  ): Promise<{ logs: SystemLogResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.System_LogWhereInput = {
      ...(query.source && { source: query.source }),
      ...(query.search && {
        OR: [{ message: { contains: query.search } }, { path: { contains: query.search } }],
      }),
      ...((query.dateFrom || query.dateTo) && {
        created_at: {
          ...(query.dateFrom && { gte: query.dateFrom }),
          ...(query.dateTo && { lte: query.dateTo }),
        },
      }),
    };

    const [total, logs] = await prisma.$transaction([
      prisma.system_Log.count({ where }),
      prisma.system_Log.findMany({ where, orderBy: { created_at: 'desc' }, skip, take }),
    ]);

    return { logs: logs.map(mapSystemLogToResponse), meta: buildPaginationMeta(total, page, pageSize) };
  }

  async getSystemLogById(id: string): Promise<SystemLogResponseDto> {
    const log = await prisma.system_Log.findUnique({ where: { id } });
    if (!log) throw AppError.notFound('System log');
    return mapSystemLogToResponse(log);
  }

  async countRecent(days: number): Promise<{ total: number; bySource: Record<string, number> }> {
    const grouped = await prisma.system_Log.groupBy({
      by: ['source'],
      where: { created_at: { gte: new Date(Date.now() - days * 86_400_000) } },
      _count: { _all: true },
    });
    const bySource: Record<string, number> = {};
    let total = 0;
    for (const row of grouped) {
      bySource[row.source ?? 'app'] = row._count._all;
      total += row._count._all;
    }
    return { total, bySource };
  }
}

export const systemLogService = new SystemLogService();
