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
    logAsync(dto: CreateAuditLogDto): void;
}
//# sourceMappingURL=audit-log.service.interface.d.ts.map