"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const user_response_dto_1 = require("../../dto/response/user.response.dto");
const token_utility_1 = require("../../utility/token.utility");
const prisma_types_1 = require("../../../../shared/prisma/prisma.types");
class UserService {
    async createUser(dto, actorId) {
        const existing = await prisma_client_1.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) {
            throw app_error_1.AppError.conflict(`User with email '${dto.email}' already exists`);
        }
        const password_hash = dto.password
            ? await (0, token_utility_1.hashPassword)(dto.password)
            : null;
        const user = await prisma_client_1.prisma.user.create({
            data: {
                email: dto.email,
                first_name: dto.firstName,
                last_name: dto.lastName,
                display_name: dto.displayName ?? `${dto.firstName} ${dto.lastName}`,
                phone: dto.phone,
                department: dto.department,
                job_title: dto.jobTitle,
                password_hash,
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
    async listRoles(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const [total, roles] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.role.count(),
            prisma_client_1.prisma.role.findMany({
                include: {
                    role_permissions: {
                        include: { permission: true },
                        orderBy: { permission: { name: 'asc' } },
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
                { name: 'asc' },
            ],
        });
        return permissions.map(user_response_dto_1.mapPermissionToResponse);
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
                ...(dto.isActive !== undefined && { is_active: dto.isActive }),
            },
            include: prisma_types_1.userWithRolesInclude,
        });
        logger_util_1.logger.info('User updated', { userId: id, actorId });
        return (0, user_response_dto_1.mapUserToResponse)(user);
    }
    async deleteUser(id, actorId) {
        await this._assertUserExists(id);
        await prisma_client_1.prisma.user.update({
            where: { id },
            data: { deleted_at: new Date(), is_active: false },
        });
        logger_util_1.logger.info('User soft-deleted', { userId: id, actorId });
    }
    async assignRoles(userId, dto, actorId) {
        await this._assertUserExists(userId);
        // Verify all roles exist
        const roles = await prisma_client_1.prisma.role.findMany({
            where: { id: { in: dto.roleIds } },
        });
        if (roles.length !== dto.roleIds.length) {
            throw app_error_1.AppError.badRequest('One or more role IDs are invalid');
        }
        // Upsert each role assignment
        await prisma_client_1.prisma.$transaction(dto.roleIds.map((roleId) => prisma_client_1.prisma.user_Role.upsert({
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
        })));
        logger_util_1.logger.info('Roles assigned', { userId, roleIds: dto.roleIds, actorId });
        return this.getUserById(userId);
    }
    async removeRole(userId, roleId, actorId) {
        await prisma_client_1.prisma.user_Role.deleteMany({
            where: { user_id: userId, role_id: roleId },
        });
        logger_util_1.logger.info('Role removed from user', { userId, roleId, actorId });
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
        logger_util_1.logger.info('Password changed', { userId });
    }
    async syncFromAzureAd(azureOid, profile) {
        const existing = await prisma_client_1.prisma.user.findFirst({
            where: {
                OR: [{ azure_oid: azureOid }, { email: profile.email }],
                deleted_at: null,
            },
            include: prisma_types_1.userWithRolesInclude,
        });
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
            logger_util_1.logger.info('User synced from Azure AD', { userId: existing.id });
            return (0, user_response_dto_1.mapUserToResponse)(updated);
        }
        // JIT provisioning: create on first SSO login
        const defaultRole = await prisma_client_1.prisma.role.findFirst({
            where: { name: 'viewer' },
        });
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
                ...(defaultRole
                    ? {
                        user_roles: {
                            create: [{ role_id: defaultRole.id }],
                        },
                    }
                    : {}),
            },
            include: prisma_types_1.userWithRolesInclude,
        });
        logger_util_1.logger.info('User JIT-provisioned from Azure AD', { userId: created.id });
        return (0, user_response_dto_1.mapUserToResponse)(created);
    }
    async _assertUserExists(id) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id, deleted_at: null },
            select: { id: true },
        });
        if (!user)
            throw app_error_1.AppError.notFound('User');
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map