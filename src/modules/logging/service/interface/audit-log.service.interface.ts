// src/modules/logging/service/interface/audit-log.service.interface.ts
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
}
