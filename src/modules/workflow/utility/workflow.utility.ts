import { AppError, PERMISSION_DENIED_MESSAGE } from '../../../shared/errors/app.error';
import { prisma } from '../../../shared/prisma/prisma.client';
import { logger } from '../../../shared/utils/logger.util';

/** Permission-based authorization gate (see audit.utility for rationale). */
export const assertHasPermission = (
  permissions: string[],
  required: string,
  message = PERMISSION_DENIED_MESSAGE,
): void => {
  if (!permissions.includes(required)) {
    throw AppError.forbidden(message);
  }
};

/**
 * Segregation of duties: whoever submitted an item for approval may not also
 * approve it. Rejecting your own submission is fine — only the sign-off is gated.
 */
export const assertNotSelfApproval = (submittedById: string, actorId: string): void => {
  if (submittedById === actorId) {
    throw AppError.forbidden(
      'You submitted this item for approval and cannot also approve it (segregation of duties). It must be approved by a different authorized user.',
    );
  }
};

/**
 * Segregation of duties across a multi-level chain: one person may not sign more
 * than one level of the same approval. Without this, a user holding several of
 * the chain's permissions (a super admin holds all of them, or one person given
 * both the oversight and final report permissions) could carry an item through
 * every level alone, defeating the point of a layered sign-off. As with
 * self-approval, only approving is gated — rejecting is always allowed.
 *
 * `approver_id` on an approved step is the person who actually signed it (the
 * approve flow overwrites a permission-pool step's null with the actor).
 */
export const assertNotPriorSigner = (
  steps: ReadonlyArray<{ level: number; status: string; approver_id: string | null }>,
  currentLevel: number,
  actorId: string,
): void => {
  const alreadySigned = steps.some(
    (step) =>
      step.level < currentLevel && step.status === 'approved' && step.approver_id === actorId,
  );
  if (alreadySigned) {
    throw AppError.forbidden(
      'You already signed an earlier level of this approval and cannot also sign a later one (segregation of duties). A different authorized user must approve this level.',
    );
  }
};

/**
 * Boot-time sanity check: escalations go to the Head of Internal Audit (whoever holds
 * `engagement:notify_lifecycle`). Warn when nobody active does — escalations would notify nobody. Never throws.
 */
export const warnOnUnresolvableEscalationTargets = async (): Promise<void> => {
  try {
    const heads = await prisma.user.count({
      where: {
        deleted_at: null,
        is_active: true,
        is_super_admin: false,
        user_roles: {
          some: { role: { role_permissions: { some: { permission: { slug: 'engagement:notify_lifecycle' } } } } },
        },
      },
    });
    if (heads === 0) {
      logger.warn(
        'No active Head of Internal Audit (engagement:notify_lifecycle) — overdue audits and stuck approvals ' +
          'will escalate to nobody until someone holds that role.',
      );
    }
  } catch (err) {
    logger.warn('Escalation startup check failed (non-fatal)', { err });
  }
};

export const hoursAgo = (hours: number): Date => {
  const value = new Date();
  value.setHours(value.getHours() - hours);
  return value;
};

export const hasElapsed = (from: Date, hours: number, now = new Date()): boolean =>
  now.getTime() - from.getTime() >= hours * 60 * 60 * 1000;
