export interface AuditLogResponseDto {
  id: string;
  userId: string | null;
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

export const mapAuditLogToResponse = (log: AuditLogRow): AuditLogResponseDto => ({
  id: log.id,
  userId: log.user_id,
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
