import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { ChainVerificationResult } from '../../utility/audit-log-hash.util';
import { ExportFormat, TabularExportFile } from '../../../../shared/utils/tabular-export.util';
import {
  AuditLogListQueryDto,
  AuditLogSummaryQueryDto,
  SecuritySummaryQueryDto,
  SystemLogListQueryDto,
} from '../../dto/request/logging.request.dto';
import {
  AuditLogResponseDto,
  AuditLogSummaryDto,
  SecuritySummaryDto,
  SystemLogResponseDto,
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
  verifyChain(): Promise<ChainVerificationResult>;
  exportLogs(query: AuditLogListQueryDto, format: ExportFormat, actorId: string): Promise<TabularExportFile>;
  getSecuritySummary(query: SecuritySummaryQueryDto): Promise<SecuritySummaryDto>;
  /** Most recent security events since a point in time (newest first), for analysis. */
  listSecurityEvents(since: Date, limit: number): Promise<AuditLogResponseDto[]>;
}

/** Read-only access to persisted application exceptions (system_logs). */
export interface ISystemLogService {
  listSystemLogs(
    query: SystemLogListQueryDto,
  ): Promise<{ logs: SystemLogResponseDto[]; meta: PaginationMeta }>;
  getSystemLogById(id: string): Promise<SystemLogResponseDto>;
  /** Exceptions recorded in the last `days` days, grouped by source. */
  countRecent(days: number): Promise<{ total: number; bySource: Record<string, number> }>;
}
