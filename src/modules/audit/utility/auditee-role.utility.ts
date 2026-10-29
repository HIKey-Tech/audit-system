import { prisma } from '../../../shared/prisma/prisma.client';
import { logger } from '../../../shared/utils/logger.util';
import { revokeUserSessions } from '../../../shared/security/session-guard';

let auditeePermissionsVerified = false;

/**
 * Ensures the `auditee` role holds the permissions required for an auditee to
 * view their engagement/findings, respond to findings, and upload evidence.
 */
const ensureAuditeeRolePermissions = async (auditeeRoleId: string): Promise<void> => {
  if (auditeePermissionsVerified) return;
  try {
    const requiredSlugs = [
      'engagement:read',
      'finding:read',
      'followup:read',
      'followup:respond',
      'followup:evidence',
      'evidence:upload',
      'document:read',
      'document:write',
    ];
    const perms = await prisma.permission.findMany({
      where: { slug: { in: requiredSlugs } },
      select: { id: true },
    });
    for (const perm of perms) {
      await prisma.role_Permission.upsert({
        where: {
          role_id_permission_id: {
            role_id: auditeeRoleId,
            permission_id: perm.id,
          },
        },
        update: {},
        create: {
          role_id: auditeeRoleId,
          permission_id: perm.id,
        },
      });
    }
    auditeePermissionsVerified = true;
  } catch (err) {
    logger.warn('Failed to verify auditee role permissions', { err });
  }
};

/**
 * Ensures every user assigned as an auditee on an engagement or as a responder
 * on a finding holds the `auditee` role in `user_roles` (additive — existing roles
 * are preserved). This guarantees they automatically hold `followup:respond`,
 * `followup:evidence`, and `evidence:upload` permissions without manual admin
 * role assignment.
 */
export const ensureAuditeeRoleAssigned = async (
  userIds: (string | null | undefined)[],
  assignedById?: string,
): Promise<void> => {
  const uniqueIds = Array.from(
    new Set(userIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
  );
  if (uniqueIds.length === 0) return;

  try {
    // Resolve the auditee role by its permission profile first (has followup:respond + followup:evidence,
    // without internal auditor working_paper:create), falling back to the role named 'auditee' if none found.
    const auditeeRole =
      (await prisma.role.findFirst({
        where: {
          AND: [
            { role_permissions: { some: { permission: { slug: 'followup:respond' } } } },
            { role_permissions: { some: { permission: { slug: 'followup:evidence' } } } },
            { role_permissions: { none: { permission: { slug: { in: ['working_paper:create', '*'] } } } } },
          ],
        },
        select: { id: true },
      })) ??
      (await prisma.role.findFirst({
        where: { name: 'auditee' },
        select: { id: true },
      }));
    if (!auditeeRole) return;

    await ensureAuditeeRolePermissions(auditeeRole.id);

    for (const userId of uniqueIds) {
      const existing = await prisma.user_Role.findFirst({
        where: {
          user_id: userId,
          role_id: auditeeRole.id,
        },
        select: { id: true },
      });
      if (!existing) {
        await prisma.user_Role.create({
          data: {
            user_id: userId,
            role_id: auditeeRole.id,
            assigned_by: assignedById ?? null,
          },
        });
        await revokeUserSessions(userId);
        logger.info('Auto-assigned auditee role to user', { userId, assignedById });
      }
    }
  } catch (err) {
    logger.warn('Failed to auto-assign auditee role', { userIds: uniqueIds, err });
  }
};
