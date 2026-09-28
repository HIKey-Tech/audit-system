import { auditLogService } from '../service/implementation/audit-log.service';
import { SECURITY_LOG_MODULE, SecurityEvent } from '../domain/enum/logging.enum';

export interface SecurityEventDetails {
  /** The account the event concerns, when it is known. */
  userId?: string | null;
  /** Account identifier as presented — kept for failed logins against unknown accounts. */
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  /** Machine-readable cause, e.g. `invalid_password`, `account_deactivated`. */
  reason?: string;
  /** How the user authenticated: `password` | `sso` | `mfa`. */
  method?: string;
  httpMethod?: string;
  path?: string;
  status?: 'success' | 'failure';
}

/**
 * Records one security event in the tamper-evident audit trail. Fire-and-forget
 * and never throws — a monitoring write must never block a sign-in.
 */
export const logSecurityEvent = (event: SecurityEvent, details: SecurityEventDetails = {}): void => {
  const { userId, ipAddress, userAgent, status, ...rest } = details;
  const values = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  auditLogService.logAsync({
    userId: userId ?? undefined,
    action: event,
    module: SECURITY_LOG_MODULE,
    entityType: userId ? 'user' : undefined,
    entityId: userId ?? undefined,
    newValues: Object.keys(values).length > 0 ? values : undefined,
    ipAddress,
    userAgent,
    status: status ?? 'success',
  });
};
