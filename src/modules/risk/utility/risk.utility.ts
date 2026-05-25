import { AppError } from '../../../shared/errors/app.error';
import { RiskScoreBand } from '../domain/enum/risk.enum';

export const RISK_ADMIN_ROLES: readonly string[] = ['super_admin', 'audit_admin'];
export const RISK_ASSESSOR_ROLES: readonly string[] = ['super_admin', 'audit_admin', 'audit_lead'];
export const AUDITEE_ROLE = 'auditee';

export const hasAuditeeRole = (roles: string[]): boolean =>
  roles.includes(AUDITEE_ROLE);

export const assertHasRole = (
  roles: string[],
  allowedRoles: readonly string[],
  message = 'Insufficient role for this risk action',
): void => {
  if (!roles.some((role) => allowedRoles.includes(role))) {
    throw AppError.forbidden(message);
  }
};

/** Permission-based authorization gate (see audit.utility for rationale). */
export const assertHasPermission = (
  permissions: string[],
  required: string,
  message = 'Insufficient permission for this action',
): void => {
  if (!permissions.includes(required)) {
    throw AppError.forbidden(message);
  }
};

export const calculateRiskScore = (likelihood: number, impact: number): number =>
  likelihood * impact;

export const getRiskScoreBand = (score: number): RiskScoreBand => {
  if (score <= 5) return RiskScoreBand.Low;
  if (score <= 12) return RiskScoreBand.Medium;
  if (score <= 19) return RiskScoreBand.High;
  return RiskScoreBand.Critical;
};

export const toIso = (value: Date | null): string | null =>
  value ? value.toISOString() : null;
