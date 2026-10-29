"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const app_config_1 = require("../../../../shared/config/app.config");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const notification_queue_service_interface_1 = require("../../../messaging/service/interface/notification-queue.service.interface");
const notification_queue_service_1 = require("../../../messaging/service/implementation/notification-queue.service");
const directory_mapping_service_1 = require("../../../integration/service/implementation/directory-mapping.service");
const graph_client_1 = require("../../../integration/service/client/graph.client");
const auditee_role_utility_1 = require("../../../audit/utility/auditee-role.utility");
const user_response_dto_1 = require("../../dto/response/user.response.dto");
const token_utility_1 = require("../../utility/token.utility");
const prisma_types_1 = require("../../../../shared/prisma/prisma.types");
const session_guard_1 = require("../../../../shared/security/session-guard");
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => {
    switch (char) {
        case '&':
            return '&amp;';
        case '<':
            return '&lt;';
        case '>':
            return '&gt;';
        case '"':
            return '&quot;';
        case "'":
            return '&#39;';
        default:
            return char;
    }
});
class UserService {
    notificationQueue;
    constructor(notificationQueue = notification_queue_service_1.notificationQueueService) {
        this.notificationQueue = notificationQueue;
    }
    async createUser(dto, actor) {
        const actorId = actor.id;
        const existing = await prisma_client_1.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) {
            throw app_error_1.AppError.conflict(`User with email '${dto.email}' already exists`);
        }
        const assignedRoles = dto.roleIds?.length
            ? await prisma_client_1.prisma.role.findMany({ where: { id: { in: dto.roleIds } } })
            : [];
        if (dto.roleIds?.length && assignedRoles.length !== dto.roleIds.length) {
            throw app_error_1.AppError.badRequest('One or more role IDs are invalid');
        }
        await this._assertCanGrantRoles(dto.roleIds ?? [], actor);
        const initialPassword = dto.password ?? (0, token_utility_1.generateTemporaryPassword)();
        const password_hash = await (0, token_utility_1.hashPassword)(initialPassword);
        const user = await prisma_client_1.prisma.user.create({
            data: {
                email: dto.email,
                first_name: dto.firstName,
                last_name: dto.lastName,
                display_name: dto.displayName ?? `${dto.firstName} ${dto.lastName}`,
                phone: dto.phone,
                department: dto.department,
                job_title: dto.jobTitle,
                ...(dto.skills && { skills: JSON.stringify(dto.skills) }),
                ...(dto.maxConcurrentEngagements !== undefined && { max_concurrent_engagements: dto.maxConcurrentEngagements }),
                password_hash,
                is_super_admin: assignedRoles.some((role) => role.name === 'super_admin'),
                ...(dto.roleIds?.length
                    ? {
                        user_roles: {
                            create: dto.roleIds.map((roleId) => ({
                                role_id: roleId,
                                assigned_by: actorId,
                            })),
                        },
                    }
                    : {}),
            },
            include: prisma_types_1.userWithRolesInclude,
        });
        logger_util_1.logger.info('User created', { userId: user.id, actorId });
        await this._sendOnboardingEmail(user, initialPassword);
        return (0, user_response_dto_1.mapUserToResponse)(user);
    }
    async getUserById(id) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id, deleted_at: null },
            include: prisma_types_1.userWithRolesInclude,
        });
        if (!user)
            throw app_error_1.AppError.notFound('User');
        return (0, user_response_dto_1.mapUserToResponse)(user);
    }
    async getUserByEmail(email) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { email, deleted_at: null },
            include: prisma_types_1.userWithRolesInclude,
        });
        if (!user)
            throw app_error_1.AppError.notFound('User');
        return (0, user_response_dto_1.mapUserToResponse)(user);
    }
    async listUsers(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            deleted_at: null,
            ...(query.isActive !== undefined && { is_active: query.isActive }),
            ...(query.department && { department: { contains: query.department } }),
            ...(query.search && {
                OR: [
                    { email: { contains: query.search } },
                    { first_name: { contains: query.search } },
                    { last_name: { contains: query.search } },
                    { display_name: { contains: query.search } },
                ],
            }),
            ...(query.roleId && {
                user_roles: { some: { role_id: query.roleId } },
            }),
        };
        const [total, users] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.user.count({ where }),
            prisma_client_1.prisma.user.findMany({
                where,
                include: prisma_types_1.userWithRolesInclude,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            users: users.map(user_response_dto_1.mapUserToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async listAccessEntitlements() {
        // System and service accounts are included on purpose: they are often the
        // most privileged identities and must be reviewed like any other.
        const users = (await prisma_client_1.prisma.user.findMany({
            where: { deleted_at: null },
            include: prisma_types_1.userWithRolesInclude,
            orderBy: { email: 'asc' },
        }));
        const now = new Date();
        return users.map((u) => (0, user_response_dto_1.mapUserToAccessEntitlement)(u, now));
    }
    async listDirectory() {
        const users = await prisma_client_1.prisma.user.findMany({
            where: { deleted_at: null, is_active: true },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                display_name: true,
                department: true,
                job_title: true,
                is_active: true,
            },
            orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
            take: 500,
        });
        return users.map(user_response_dto_1.mapUserToDirectory);
    }
    async provisionDirectoryUser(dto, actorId) {
        const email = dto.email.trim().toLowerCase();
        const existing = await prisma_client_1.prisma.user.findFirst({
            where: { email, deleted_at: null },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                display_name: true,
                department: true,
                job_title: true,
                is_active: true,
            },
        });
        if (existing) {
            if (!existing.is_active) {
                await prisma_client_1.prisma.user.update({ where: { id: existing.id }, data: { is_active: true } });
                existing.is_active = true;
            }
            await (0, auditee_role_utility_1.ensureAuditeeRoleAssigned)([existing.id], actorId);
            return (0, user_response_dto_1.mapUserToDirectory)(existing);
        }
        const localPart = email.split('@')[0] ?? 'staff';
        const nameTokens = localPart
            .split(/[._-]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
        const firstName = dto.firstName?.trim() || nameTokens[0] || 'Staff';
        const lastName = dto.lastName?.trim() || nameTokens.slice(1).join(' ') || 'Member';
        const displayName = dto.displayName?.trim() || `${firstName} ${lastName}`.trim();
        const created = await prisma_client_1.prisma.user.create({
            data: {
                email,
                first_name: firstName,
                last_name: lastName,
                display_name: displayName,
                department: dto.department?.trim() || null,
                job_title: dto.jobTitle?.trim() || null,
                email_verified: true,
                is_active: true,
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                display_name: true,
                department: true,
                job_title: true,
                is_active: true,
            },
        });
        await (0, auditee_role_utility_1.ensureAuditeeRoleAssigned)([created.id], actorId);
        const loginUrl = `${app_config_1.config.app.frontendUrl.replace(/\/$/, '')}/login`;
        await this.notificationQueue.enqueueSafe('email', {
            to: email,
            subject: `IAMS Access Provisioned — ${app_config_1.config.app.name}`,
            text: [
                `Dear ${displayName},`,
                '',
                `Your corporate account (${email}) has been registered on ${app_config_1.config.app.name} (Internal Audit Management System) so you can receive audit notifications, review assigned audit items, and submit responses.`,
                '',
                `You can sign in using your corporate Active Directory credentials at: ${loginUrl}`,
                '',
                'Regards,',
                'IAMS — Internal Audit System',
            ].join('\n'),
        });
        logger_util_1.logger.info('Pre-provisioned AD / directory user as auditee', { userId: created.id, email, actorId });
        return (0, user_response_dto_1.mapUserToDirectory)(created);
    }
    async listRoles(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const [total, roles] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.role.count(),
            prisma_client_1.prisma.role.findMany({
                include: {
                    role_permissions: {
                        include: { permission: true },
                        orderBy: { permission: { slug: 'asc' } },
                    },
                },
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            roles: roles.map(user_response_dto_1.mapRoleToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async listPermissions() {
        const permissions = await prisma_client_1.prisma.permission.findMany({
            orderBy: [
                { module: 'asc' },
                { action: 'asc' },
                { slug: 'asc' },
            ],
        });
        return permissions.map(user_response_dto_1.mapPermissionToResponse);
    }
    async getRoleById(id) {
        const role = await prisma_client_1.prisma.role.findUnique({
            where: { id },
            include: {
                role_permissions: {
                    include: { permission: true },
                    orderBy: { permission: { slug: 'asc' } },
                },
            },
        });
        if (!role)
            throw app_error_1.AppError.notFound('Role');
        return (0, user_response_dto_1.mapRoleToResponse)(role);
    }
    async createRole(dto, actorId) {
        const existing = await prisma_client_1.prisma.role.findUnique({ where: { name: dto.name } });
        if (existing) {
            throw app_error_1.AppError.conflict(`Role with name '${dto.name}' already exists`);
        }
        await this._assertPermissionsExist(dto.permissionIds ?? []);
        const role = await prisma_client_1.prisma.role.create({
            data: {
                name: dto.name,
                description: dto.description,
                is_system: false,
                ...(dto.permissionIds?.length
                    ? {
                        role_permissions: {
                            create: dto.permissionIds.map((permissionId) => ({
                                permission_id: permissionId,
                            })),
                        },
                    }
                    : {}),
            },
            include: {
                role_permissions: {
                    include: { permission: true },
                    orderBy: { permission: { slug: 'asc' } },
                },
            },
        });
        logger_util_1.logger.info('Role created', { roleId: role.id, actorId });
        return (0, user_response_dto_1.mapRoleToResponse)(role);
    }
    async updateRole(id, dto, actorId) {
        const existing = await prisma_client_1.prisma.role.findUnique({ where: { id } });
        if (!existing)
            throw app_error_1.AppError.notFound('Role');
        if (dto.name && dto.name !== existing.name) {
            const nameOwner = await prisma_client_1.prisma.role.findUnique({ where: { name: dto.name } });
            if (nameOwner) {
                throw app_error_1.AppError.conflict(`Role with name '${dto.name}' already exists`);
            }
        }
        const role = await prisma_client_1.prisma.role.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
            },
            include: {
                role_permissions: {
                    include: { permission: true },
                    orderBy: { permission: { slug: 'asc' } },
                },
            },
        });
        logger_util_1.logger.info('Role updated', { roleId: id, actorId });
        return (0, user_response_dto_1.mapRoleToResponse)(role);
    }
    async deleteRole(id, actorId) {
        const role = await prisma_client_1.prisma.role.findUnique({
            where: { id },
            select: { id: true, is_system: true },
        });
        if (!role)
            throw app_error_1.AppError.notFound('Role');
        if (role.is_system) {
            throw app_error_1.AppError.badRequest('System roles cannot be deleted');
        }
        const assignedUsers = await prisma_client_1.prisma.user_Role.count({ where: { role_id: id } });
        if (assignedUsers > 0) {
            throw app_error_1.AppError.conflict('Role cannot be deleted while assigned to users');
        }
        await prisma_client_1.prisma.role.delete({ where: { id } });
        logger_util_1.logger.info('Role deleted', { roleId: id, actorId });
    }
    async replaceRolePermissions(id, dto, actorId) {
        const role = await prisma_client_1.prisma.role.findUnique({ where: { id }, select: { id: true } });
        if (!role)
            throw app_error_1.AppError.notFound('Role');
        await this._assertPermissionsExist(dto.permissionIds);
        await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.role_Permission.deleteMany({ where: { role_id: id } }),
            prisma_client_1.prisma.role_Permission.createMany({
                data: dto.permissionIds.map((permissionId) => ({
                    role_id: id,
                    permission_id: permissionId,
                })),
            }),
        ]);
        logger_util_1.logger.info('Role permissions replaced', {
            roleId: id,
            permissionIds: dto.permissionIds,
            actorId,
        });
        return this.getRoleById(id);
    }
    async listPermissionsGroupedByModule() {
        const permissions = await prisma_client_1.prisma.permission.findMany({
            orderBy: [
                { module: 'asc' },
                { action: 'asc' },
                { slug: 'asc' },
            ],
        });
        const grouped = new Map();
        for (const permission of permissions) {
            const current = grouped.get(permission.module) ?? [];
            current.push((0, user_response_dto_1.mapPermissionToResponse)(permission));
            grouped.set(permission.module, current);
        }
        return [...grouped.entries()].map(([module, modulePermissions]) => ({
            module,
            permissions: modulePermissions,
        }));
    }
    async updateUser(id, dto, actorId) {
        await this._assertUserExists(id);
        const user = await prisma_client_1.prisma.user.update({
            where: { id },
            data: {
                ...(dto.firstName && { first_name: dto.firstName }),
                ...(dto.lastName && { last_name: dto.lastName }),
                ...(dto.displayName !== undefined && { display_name: dto.displayName }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.department !== undefined && { department: dto.department }),
                ...(dto.jobTitle !== undefined && { job_title: dto.jobTitle }),
                ...(dto.skills !== undefined && { skills: dto.skills ? JSON.stringify(dto.skills) : null }),
                ...(dto.maxConcurrentEngagements !== undefined && { max_concurrent_engagements: dto.maxConcurrentEngagements }),
            },
            include: prisma_types_1.userWithRolesInclude,
        });
        logger_util_1.logger.info('User updated', { userId: id, actorId });
        return (0, user_response_dto_1.mapUserToResponse)(user);
    }
    async setUserActiveStatus(id, isActive, actorId) {
        await this._assertUserExists(id);
        if (id === actorId && !isActive) {
            throw app_error_1.AppError.badRequest('You cannot deactivate your own account');
        }
        const user = await prisma_client_1.prisma.user.update({
            where: { id },
            data: { is_active: isActive },
            include: prisma_types_1.userWithRolesInclude,
        });
        // Reflect the change in the session guard: refresh the liveness snapshot and,
        // on deactivation, invalidate the user's outstanding access tokens now.
        await (0, session_guard_1.setUserActiveSnapshot)(id, isActive);
        if (!isActive)
            await (0, session_guard_1.revokeUserSessions)(id);
        logger_util_1.logger.info(isActive ? 'User activated' : 'User deactivated', {
            userId: id,
            actorId,
        });
        return (0, user_response_dto_1.mapUserToResponse)(user);
    }
    async deleteUser(id, actorId) {
        await this._assertUserExists(id);
        if (id === actorId) {
            throw app_error_1.AppError.badRequest('You cannot delete your own account');
        }
        await prisma_client_1.prisma.user.update({
            where: { id },
            data: { deleted_at: new Date(), is_active: false },
        });
        // Lock the deleted user out of any live session immediately.
        await (0, session_guard_1.setUserActiveSnapshot)(id, false);
        await (0, session_guard_1.revokeUserSessions)(id);
        logger_util_1.logger.info('User soft-deleted', { userId: id, actorId });
    }
    async assignRoles(userId, dto, actor) {
        const actorId = actor.id;
        await this._assertUserExists(userId);
        // Verify all roles exist
        const roles = await prisma_client_1.prisma.role.findMany({
            where: { id: { in: dto.roleIds } },
        });
        if (roles.length !== dto.roleIds.length) {
            throw app_error_1.AppError.badRequest('One or more role IDs are invalid');
        }
        // Identify current roles so we can remove unselected ones
        const currentRoles = await prisma_client_1.prisma.user_Role.findMany({
            where: { user_id: userId },
            select: { role_id: true },
        });
        const currentRoleIds = currentRoles.map((r) => r.role_id);
        const rolesToRemove = currentRoleIds.filter((id) => !dto.roleIds.includes(id));
        // Verify actor can grant the new roles and remove unselected roles
        await this._assertCanGrantRoles([...dto.roleIds, ...rolesToRemove], actor);
        // Reconcile role assignments in a single transaction
        await prisma_client_1.prisma.$transaction([
            ...(rolesToRemove.length > 0
                ? [
                    prisma_client_1.prisma.user_Role.deleteMany({
                        where: {
                            user_id: userId,
                            role_id: { in: rolesToRemove },
                        },
                    }),
                ]
                : []),
            ...dto.roleIds.map((roleId) => prisma_client_1.prisma.user_Role.upsert({
                where: { user_id_role_id: { user_id: userId, role_id: roleId } },
                create: {
                    user_id: userId,
                    role_id: roleId,
                    assigned_by: actorId,
                    expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
                },
                update: {
                    assigned_by: actorId,
                    expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
                },
            })),
        ]);
        logger_util_1.logger.info('Roles assigned and reconciled', {
            userId,
            roleIds: dto.roleIds,
            removedRoleIds: rolesToRemove,
            actorId,
        });
        await this._syncUserSuperAdminFlag(userId);
        // Force the next request to pick up the new authority: the current access
        // token (with stale permissions) is rejected and silently refreshed.
        await (0, session_guard_1.revokeUserSessions)(userId);
        return this.getUserById(userId);
    }
    async removeRole(userId, roleId, actor) {
        const actorId = actor.id;
        // Removing super_admin is itself a privileged action — only a super admin
        // may do it (prevents a lesser admin from manipulating it).
        await this._assertCanGrantRoles([roleId], actor);
        await prisma_client_1.prisma.user_Role.deleteMany({
            where: { user_id: userId, role_id: roleId },
        });
        logger_util_1.logger.info('Role removed from user', { userId, roleId, actorId });
        await this._syncUserSuperAdminFlag(userId);
        // Revoke the stale-permission access token; the next refresh reflects the change.
        await (0, session_guard_1.revokeUserSessions)(userId);
        return this.getUserById(userId);
    }
    async changePassword(userId, dto) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id: userId, deleted_at: null },
            select: { password_hash: true },
        });
        if (!user)
            throw app_error_1.AppError.notFound('User');
        if (!user.password_hash) {
            throw app_error_1.AppError.badRequest('Password change is not available for SSO-only accounts');
        }
        const currentValid = await (0, token_utility_1.comparePassword)(dto.currentPassword, user.password_hash);
        if (!currentValid) {
            throw app_error_1.AppError.badRequest('Current password is incorrect');
        }
        const newHash = await (0, token_utility_1.hashPassword)(dto.newPassword);
        await prisma_client_1.prisma.user.update({
            where: { id: userId },
            data: { password_hash: newHash },
        });
        // A password change invalidates sessions opened with the old credential.
        await prisma_client_1.prisma.refresh_Token.updateMany({
            where: { user_id: userId, revoked_at: null },
            data: { revoked_at: new Date() },
        });
        await (0, session_guard_1.revokeUserSessions)(userId);
        logger_util_1.logger.info('Password changed', { userId });
    }
    async syncFromAzureAd(azureOid, profile) {
        // Resolve strictly by the immutable subject id first. Email is only used as
        // a fallback to link a pre-existing local account, and never to silently
        // take over an account already bound to a different identity.
        let existing = await prisma_client_1.prisma.user.findFirst({
            where: { azure_oid: azureOid, deleted_at: null },
            include: prisma_types_1.userWithRolesInclude,
        });
        if (!existing) {
            const byEmail = await prisma_client_1.prisma.user.findFirst({
                where: { email: profile.email, deleted_at: null },
                include: prisma_types_1.userWithRolesInclude,
            });
            if (byEmail) {
                if (byEmail.azure_oid && byEmail.azure_oid !== azureOid) {
                    // The email belongs to an account already linked to a different IdP
                    // subject — refuse rather than hijack it.
                    logger_util_1.logger.warn('SSO email collides with a different linked account', {
                        userId: byEmail.id,
                        attemptedOid: azureOid,
                    });
                    throw app_error_1.AppError.unauthorized('This account cannot be linked via single sign-on.');
                }
                if (!profile.emailVerified) {
                    // Don't link a local account on the strength of an unverified email.
                    logger_util_1.logger.warn('SSO link refused — unverified email', { email: profile.email });
                    throw app_error_1.AppError.unauthorized('Your identity provider did not verify this email address.');
                }
                existing = byEmail;
            }
        }
        if (existing) {
            // Sync latest profile data from IdP
            const updated = await prisma_client_1.prisma.user.update({
                where: { id: existing.id },
                data: {
                    azure_oid: azureOid,
                    email: profile.email,
                    first_name: profile.givenName ?? existing.first_name,
                    last_name: profile.familyName ?? existing.last_name,
                    display_name: profile.displayName ?? existing.display_name,
                    job_title: profile.jobTitle ?? existing.job_title,
                    department: profile.department ?? existing.department,
                    email_verified: true,
                },
                include: prisma_types_1.userWithRolesInclude,
            });
            await this._applyDirectoryRoles(updated.id, profile);
            const refreshed = await prisma_client_1.prisma.user.findUniqueOrThrow({
                where: { id: updated.id },
                include: prisma_types_1.userWithRolesInclude,
            });
            logger_util_1.logger.info('User synced from Azure AD', { userId: existing.id });
            return (0, user_response_dto_1.mapUserToResponse)(refreshed);
        }
        // JIT provisioning: create on first SSO login. Roles come from Azure
        // group→role mapping (applied below); unmapped users get zero roles.
        const created = await prisma_client_1.prisma.user.create({
            data: {
                azure_oid: azureOid,
                email: profile.email,
                first_name: profile.givenName ?? profile.email.split('@')[0],
                last_name: profile.familyName ?? '',
                display_name: profile.displayName,
                job_title: profile.jobTitle,
                department: profile.department,
                email_verified: true,
            },
            include: prisma_types_1.userWithRolesInclude,
        });
        await this._applyDirectoryRoles(created.id, profile);
        const provisioned = await prisma_client_1.prisma.user.findUniqueOrThrow({
            where: { id: created.id },
            include: prisma_types_1.userWithRolesInclude,
        });
        logger_util_1.logger.info('User JIT-provisioned from Azure AD', { userId: created.id });
        return (0, user_response_dto_1.mapUserToResponse)(provisioned);
    }
    /**
     * Applies Azure AD group→role mappings to a user on SSO login. Falls back
     * to a Microsoft Graph lookup when the token omitted groups (overage).
     * Never throws — a role-sync failure must not block login.
     */
    async _applyDirectoryRoles(userId, profile) {
        try {
            let groupIds = profile.groups ?? [];
            if (profile.groupsOverage) {
                groupIds = await (0, graph_client_1.createGraphDirectoryClient)().getUserGroupIds(profile.oid);
            }
            await directory_mapping_service_1.directoryMappingService.applyAdRolesToUser(userId, groupIds);
        }
        catch (err) {
            logger_util_1.logger.error('Directory role apply failed during SSO login', { userId, err });
        }
    }
    /**
     * Syncs or provisions a user authenticated via on-premises Active Directory (LDAP).
     * Maps AD security groups to IAMS roles via directory_group_mappings.
     */
    async syncFromLdap(profile) {
        const email = profile.email.toLowerCase();
        let existing = await prisma_client_1.prisma.user.findFirst({
            where: { email, deleted_at: null },
            include: prisma_types_1.userWithRolesInclude,
        });
        if (existing) {
            const updated = await prisma_client_1.prisma.user.update({
                where: { id: existing.id },
                data: {
                    first_name: profile.givenName ?? existing.first_name,
                    last_name: profile.familyName ?? existing.last_name,
                    display_name: profile.displayName ?? existing.display_name,
                    job_title: profile.jobTitle ?? existing.job_title,
                    department: profile.department ?? existing.department,
                    phone: profile.phone ?? existing.phone,
                    email_verified: true,
                },
                include: prisma_types_1.userWithRolesInclude,
            });
            await this._applyLdapDirectoryRoles(updated.id, profile);
            const refreshed = await prisma_client_1.prisma.user.findUniqueOrThrow({
                where: { id: updated.id },
                include: prisma_types_1.userWithRolesInclude,
            });
            logger_util_1.logger.info('User synced from on-premises Active Directory', { userId: existing.id, email });
            return (0, user_response_dto_1.mapUserToResponse)(refreshed);
        }
        // JIT provisioning on first AD login
        const created = await prisma_client_1.prisma.user.create({
            data: {
                email,
                first_name: profile.givenName ?? profile.sAMAccountName,
                last_name: profile.familyName ?? '',
                display_name: profile.displayName ||
                    `${profile.givenName || ''} ${profile.familyName || ''}`.trim() ||
                    profile.sAMAccountName,
                job_title: profile.jobTitle,
                department: profile.department,
                phone: profile.phone,
                email_verified: true,
            },
            include: prisma_types_1.userWithRolesInclude,
        });
        await this._applyLdapDirectoryRoles(created.id, profile);
        const provisioned = await prisma_client_1.prisma.user.findUniqueOrThrow({
            where: { id: created.id },
            include: prisma_types_1.userWithRolesInclude,
        });
        logger_util_1.logger.info('User JIT-provisioned from on-premises Active Directory', { userId: created.id, email });
        return (0, user_response_dto_1.mapUserToResponse)(provisioned);
    }
    async _applyLdapDirectoryRoles(userId, profile) {
        try {
            await directory_mapping_service_1.directoryMappingService.applyAdRolesToUser(userId, profile.groups);
        }
        catch (err) {
            logger_util_1.logger.error('Directory role apply failed during LDAP login', { userId, err });
        }
    }
    /**
     * Least-privilege guard for granting/removing roles. A super admin may manage
     * any role. Everyone else:
     *   - may never grant or remove the `super_admin` role, and
     *   - may only assign roles whose permission set is a subset of their own
     *     (you cannot hand out authority you do not hold — blocks self/lateral
     *     privilege escalation through `role:assign` / `user:create`).
     */
    async _assertCanGrantRoles(roleIds, actor) {
        if (actor.isSuperAdmin || roleIds.length === 0)
            return;
        const roles = await prisma_client_1.prisma.role.findMany({
            where: { id: { in: roleIds } },
            include: { role_permissions: { include: { permission: true } } },
        });
        if (roles.some((r) => r.name === 'super_admin')) {
            throw app_error_1.AppError.forbidden('Only a super admin can grant or remove the super admin role');
        }
        const actorPerms = new Set(actor.permissions);
        for (const role of roles) {
            for (const rp of role.role_permissions) {
                if (!actorPerms.has(rp.permission.slug)) {
                    throw app_error_1.AppError.forbidden('You cannot assign a role that grants permissions you do not hold');
                }
            }
        }
    }
    async _assertUserExists(id) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id, deleted_at: null },
            select: { id: true },
        });
        if (!user)
            throw app_error_1.AppError.notFound('User');
    }
    async _assertPermissionsExist(permissionIds) {
        if (permissionIds.length === 0)
            return;
        const permissions = await prisma_client_1.prisma.permission.findMany({
            where: { id: { in: permissionIds } },
            select: { id: true },
        });
        if (permissions.length !== permissionIds.length) {
            throw app_error_1.AppError.badRequest('One or more permission IDs are invalid');
        }
    }
    async _syncUserSuperAdminFlag(userId) {
        const superAdminRole = await prisma_client_1.prisma.user_Role.findFirst({
            where: {
                user_id: userId,
                role: { name: 'super_admin' },
                OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
            },
            select: { id: true },
        });
        await prisma_client_1.prisma.user.update({
            where: { id: userId },
            data: { is_super_admin: Boolean(superAdminRole) },
        });
    }
    async _sendOnboardingEmail(user, temporaryPassword) {
        const displayName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
        const loginUrl = `${app_config_1.config.app.url.replace(/\/$/, '')}/login`;
        const appName = app_config_1.config.app.name;
        await this.notificationQueue.enqueue('email', {
            to: user.email,
            subject: `Welcome to ${appName}`,
            template: 'user-onboarding',
            text: [
                `Hello ${displayName},`,
                '',
                `Your ${appName} account has been created.`,
                '',
                `Login URL: ${loginUrl}`,
                `Email: ${user.email}`,
                `Temporary password: ${temporaryPassword}`,
                '',
                'Please sign in and change your password immediately.',
            ].join('\n'),
            html: [
                `<p>Hello ${escapeHtml(displayName)},</p>`,
                `<p>Your ${escapeHtml(appName)} account has been created.</p>`,
                '<p>Use the credentials below to sign in:</p>',
                '<ul>',
                `<li><strong>Login URL:</strong> <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></li>`,
                `<li><strong>Email:</strong> ${escapeHtml(user.email)}</li>`,
                `<li><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</li>`,
                '</ul>',
                '<p>Please sign in and change your password immediately.</p>',
            ].join(''),
        }, { priority: notification_queue_service_interface_1.NOTIFICATION_PRIORITY.HIGH });
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map