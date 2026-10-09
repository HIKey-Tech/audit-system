import { SecurityEvent } from '../domain/enum/logging.enum';
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
export declare const logSecurityEvent: (event: SecurityEvent, details?: SecurityEventDetails) => void;
//# sourceMappingURL=security-event.utility.d.ts.map