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
export interface SecurityEventCountsDto {
    loginSucceeded: number;
    loginFailed: number;
    mfaFailed: number;
    accessDenied: number;
    tokenReuseDetected: number;
    passwordResets: number;
    mfaResets: number;
}
export interface SecuritySummaryDto {
    windowDays: number;
    from: string;
    to: string;
    totals: SecurityEventCountsDto;
    byDay: Array<{
        date: string;
        loginSucceeded: number;
        loginFailed: number;
        accessDenied: number;
    }>;
    /** Accounts with the most failed sign-ins — the brute-force / credential-stuffing signal. */
    topFailedAccounts: Array<{
        account: string;
        count: number;
        lastAt: string;
        distinctIps: number;
    }>;
    /** Users most often refused by the permission checks. */
    topDeniedUsers: Array<{
        userId: string | null;
        userName: string | null;
        count: number;
        lastPath: string | null;
    }>;
    /** True when the window held more events than were analysed. */
    truncated: boolean;
}
export interface SystemLogResponseDto {
    id: string;
    level: string;
    message: string;
    source: string | null;
    errorName: string | null;
    path: string | null;
    requestId: string | null;
    stack: string | null;
    context: unknown;
    createdAt: string;
}
interface SystemLogRow {
    id: string;
    level: string;
    message: string;
    source: string | null;
    error_name: string | null;
    path: string | null;
    request_id: string | null;
    stack: string | null;
    context: string | null;
    created_at: Date;
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
export declare const mapSystemLogToResponse: (log: SystemLogRow) => SystemLogResponseDto;
export {};
//# sourceMappingURL=logging.response.dto.d.ts.map