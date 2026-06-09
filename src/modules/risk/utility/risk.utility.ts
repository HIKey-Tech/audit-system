import { AppError } from '../../../shared/errors/app.error';
import { RiskScoreBand } from '../domain/enum/risk.enum';

export const AUDITEE_ROLE = 'auditee';

export const hasAuditeeRole = (roles: string[]): boolean =>
  roles.includes(AUDITEE_ROLE);

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
