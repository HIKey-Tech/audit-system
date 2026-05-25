import { AppError } from '../../../shared/errors/app.error';

export const WORKFLOW_ADMIN_ROLES: readonly string[] = ['super_admin', 'audit_admin'];
export const WORKFLOW_APPROVER_ROLES: readonly string[] = ['super_admin', 'audit_admin', 'audit_lead'];

export const assertHasRole = (
  roles: string[],
  allowedRoles: readonly string[],
  message = 'Insufficient role for this workflow action',
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

export const hoursAgo = (hours: number): Date => {
  const value = new Date();
  value.setHours(value.getHours() - hours);
  return value;
};

export const hasElapsed = (from: Date, hours: number, now = new Date()): boolean =>
  now.getTime() - from.getTime() >= hours * 60 * 60 * 1000;
