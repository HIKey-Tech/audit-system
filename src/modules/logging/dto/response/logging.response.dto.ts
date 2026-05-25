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
