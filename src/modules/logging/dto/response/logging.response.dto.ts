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
  byDay: Array<{ date: string; loginSucceeded: number; loginFailed: number; accessDenied: number }>;
  /** Accounts with the most failed sign-ins — the brute-force / credential-stuffing signal. */
  topFailedAccounts: Array<{ account: string; count: number; lastAt: string; distinctIps: number }>;
  /** Users most often refused by the permission checks. */
  topDeniedUsers: Array<{ userId: string | null; userName: string | null; count: number; lastPath: string | null }>;
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

const parseJsonValue = (value: string | null): unknown => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const resolveDisplayName = (user: AuditLogUserRow | null | undefined): string | null => {
  if (!user) return null;
  if (user.display_name && user.display_name.trim()) return user.display_name.trim();
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  if (full) return full;
  return user.email ?? null;
};

export const mapAuditLogToResponse = (log: AuditLogRow): AuditLogResponseDto => ({
  id: log.id,
  userId: log.user_id,
  userDisplayName: resolveDisplayName(log.user),
  action: log.action,
  module: log.module,
  entityType: log.entity_type,
  entityId: log.entity_id,
  oldValues: parseJsonValue(log.old_values),
  newValues: parseJsonValue(log.new_values),
  ipAddress: log.ip_address,
  userAgent: log.user_agent,
  status: log.status,
  errorMessage: log.error_message,
  durationMs: log.duration_ms,
  createdAt: log.created_at.toISOString(),
});

export const mapSystemLogToResponse = (log: SystemLogRow): SystemLogResponseDto => ({
  id: log.id,
  level: log.level,
  message: log.message,
  source: log.source,
  errorName: log.error_name,
  path: log.path,
  requestId: log.request_id,
  stack: log.stack,
  context: parseJsonValue(log.context),
  createdAt: log.created_at.toISOString(),
});
