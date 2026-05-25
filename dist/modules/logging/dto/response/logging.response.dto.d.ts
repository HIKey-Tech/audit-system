export interface AuditLogResponseDto {
    id: string;
    userId: string | null;
    userDisplayName: string | null;
    action: string;
    module: string;
    entityType: string | null;
    entityId: string | null;
    oldValues: unknown;
    newValues: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    status: string;
    errorMessage: string | null;
    durationMs: number | null;
    createdAt: string;
}
export interface AuditLogSummaryDto {
    module: string;
    totalActions: number;
    successCount: number;
    failureCount: number;
}
interface AuditLogUserRow {
    display_name: string | null;
    first_name: string;
    last_name: string;
    email: string;
}
interface AuditLogRow {
    id: string;
    user_id: string | null;
    action: string;
    module: string;
    entity_type: string | null;
    entity_id: string | null;
    old_values: string | null;
    new_values: string | null;
    ip_address: string | null;
    user_agent: string | null;
    status: string;
    error_message: string | null;
    duration_ms: number | null;
    created_at: Date;
    user?: AuditLogUserRow | null;
}
export declare const mapAuditLogToResponse: (log: AuditLogRow) => AuditLogResponseDto;
export {};
//# sourceMappingURL=logging.response.dto.d.ts.map