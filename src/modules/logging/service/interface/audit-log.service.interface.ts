import { PaginationMeta } from '../../../../shared/types/api-response.type';
import {
  AuditLogListQueryDto,
  AuditLogSummaryQueryDto,
} from '../../dto/request/logging.request.dto';
import {
  AuditLogResponseDto,
  AuditLogSummaryDto,
} from '../../dto/response/logging.response.dto';

export interface CreateAuditLogDto {
  userId?: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failure';
  errorMessage?: string;
  durationMs?: number;
}

export interface IAuditLogService {
  log(dto: CreateAuditLogDto): Promise<void>;
  logAsync(dto: CreateAuditLogDto): void; // fire-and-forget
  listLogs(
    query: AuditLogListQueryDto,
  ): Promise<{ logs: AuditLogResponseDto[]; meta: PaginationMeta }>;
  getLogById(id: string): Promise<AuditLogResponseDto>;
  getDistinctModules(): Promise<string[]>;
  getLogSummary(query: AuditLogSummaryQueryDto): Promise<AuditLogSummaryDto[]>;
}
