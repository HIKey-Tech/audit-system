"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAuditeeRoleAssigned = void 0;
const prisma_client_1 = require("../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../shared/utils/logger.util");
const session_guard_1 = require("../../../shared/security/session-guard");
let auditeePermissionsVerified = false;
/**
 * Ensures the `auditee` role holds the permissions required for an auditee to
 * view their engagement/findings, respond to findings, and upload evidence.
 */
const ensureAuditeeRolePermissions = async (auditeeRoleId) => {
    if (auditeePermissionsVerified)
        return;
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
        const perms = await prisma_client_1.prisma.permission.findMany({
            where: { slug: { in: requiredSlugs } },
            select: { id: true },
        });
        for (const perm of perms) {
            await prisma_client_1.prisma.role_Permission.upsert({
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
    }
    catch (err) {
        logger_util_1.logger.warn('Failed to verify auditee role permissions', { err });
    }
};
/**
 * Ensures every user assigned as an auditee on an engagement or as a responder
 * on a finding holds the `auditee` role in `user_roles` (additive — existing roles
 * are preserved). This guarantees they automatically hold `followup:respond`,
 * `followup:evidence`, and `evidence:upload` permissions without manual admin
 * role assignment.
 */
const ensureAuditeeRoleAssigned = async (userIds, assignedById) => {
    const uniqueIds = Array.from(new Set(userIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    if (uniqueIds.length === 0)
        return;
    try {
        // Resolve the auditee role by its permission profile first (has followup:respond + followup:evidence,
        // without internal auditor working_paper:create), falling back to the role named 'auditee' if none found.
        const auditeeRole = (await prisma_client_1.prisma.role.findFirst({
            where: {
                AND: [
                    { role_permissions: { some: { permission: { slug: 'followup:respond' } } } },
                    { role_permissions: { some: { permission: { slug: 'followup:evidence' } } } },
                    { role_permissions: { none: { permission: { slug: { in: ['working_paper:create', '*'] } } } } },
                ],
            },
            select: { id: true },
        })) ??
            (await prisma_client_1.prisma.role.findFirst({
                where: { name: 'auditee' },
                select: { id: true },
            }));
        if (!auditeeRole)
            return;
        await ensureAuditeeRolePermissions(auditeeRole.id);
        for (const userId of uniqueIds) {
            const existing = await prisma_client_1.prisma.user_Role.findFirst({
                where: {
                    user_id: userId,
                    role_id: auditeeRole.id,
                },
                select: { id: true },
            });
            if (!existing) {
                await prisma_client_1.prisma.user_Role.create({
                    data: {
                        user_id: userId,
                        role_id: auditeeRole.id,
                        assigned_by: assignedById ?? null,
                    },
                });
                await (0, session_guard_1.revokeUserSessions)(userId);
                logger_util_1.logger.info('Auto-assigned auditee role to user', { userId, assignedById });
            }
        }
    }
    catch (err) {
        logger_util_1.logger.warn('Failed to auto-assign auditee role', { userIds: uniqueIds, err });
    }
};
exports.ensureAuditeeRoleAssigned = ensureAuditeeRoleAssigned;
//# sourceMappingURL=auditee-role.utility.js.map