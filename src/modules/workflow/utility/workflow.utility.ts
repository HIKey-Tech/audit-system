import { AppError } from '../../../shared/errors/app.error';

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
