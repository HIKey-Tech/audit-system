"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.directoryMappingService = exports.DirectoryMappingService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
const app_error_1 = require("../../../../shared/errors/app.error");
const audit_log_service_1 = require("../../../logging/service/implementation/audit-log.service");
const role_reconciler_utility_1 = require("../../utility/role-reconciler.utility");
const graph_client_1 = require("../client/graph.client");
const toMapping = (m) => ({
    id: m.id,
    adGroupId: m.ad_group_id,
    adGroupName: m.ad_group_name,
    roleId: m.role_id,
    roleName: m.role?.name,
    isActive: m.is_active,
    createdAt: m.created_at,
});
class DirectoryMappingService {
    graph;
    constructor(graph = (0, graph_client_1.createGraphDirectoryClient)()) {
        this.graph = graph;
    }
    async createMapping(dto, actorId) {
        const role = await prisma_client_1.prisma.role.findUnique({ where: { id: dto.roleId } });
        if (!role)
            throw app_error_1.AppError.badRequest('roleId does not reference a known role');
        const existing = await prisma_client_1.prisma.directory_Group_Mapping.findFirst({
            where: { ad_group_id: dto.adGroupId, role_id: dto.roleId },
        });
        if (existing)
            throw app_error_1.AppError.conflict('This group is already mapped to this role');
        const created = await prisma_client_1.prisma.directory_Group_Mapping.create({
            data: {
                ad_group_id: dto.adGroupId,
                ad_group_name: dto.adGroupName,
                role_id: dto.roleId,
                created_by: actorId,
            },
            include: { role: true },
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            module: 'integration',
            action: 'directory_mapping.create',
            entityType: 'directory_group_mapping',
            entityId: created.id,
            status: 'success',
        });
        logger_util_1.logger.info('Directory group mapping created', { actorId, id: created.id });
        return toMapping(created);
    }
    async updateMapping(id, dto, actorId) {
        await this._assertExists(id);
        if (dto.roleId) {
            const role = await prisma_client_1.prisma.role.findUnique({ where: { id: dto.roleId } });
            if (!role)
                throw app_error_1.AppError.badRequest('roleId does not reference a known role');
        }
        const updated = await prisma_client_1.prisma.directory_Group_Mapping.update({
            where: { id },
            data: {
                ad_group_name: dto.adGroupName,
                role_id: dto.roleId,
                is_active: dto.isActive,
            },
            include: { role: true },
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            module: 'integration',
            action: 'directory_mapping.update',
            entityType: 'directory_group_mapping',
            entityId: id,
            status: 'success',
        });
        return toMapping(updated);
    }
    async deleteMapping(id, actorId) {
        await this._assertExists(id);
        await prisma_client_1.prisma.directory_Group_Mapping.delete({ where: { id } });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            module: 'integration',
            action: 'directory_mapping.delete',
            entityType: 'directory_group_mapping',
            entityId: id,
            status: 'success',
        });
    }
    async listMappings() {
        const rows = await prisma_client_1.prisma.directory_Group_Mapping.findMany({
            include: { role: true },
            orderBy: { created_at: 'desc' },
        });
        return rows.map(toMapping);
    }
    async resolveRolesForGroups(groupIds) {
        if (groupIds.length === 0)
            return [];
        const mappings = await prisma_client_1.prisma.directory_Group_Mapping.findMany({
            where: { is_active: true, ad_group_id: { in: groupIds } },
            select: { role_id: true },
        });
        return [...new Set(mappings.map((m) => m.role_id))];
    }
    async applyAdRolesToUser(userId, groupIds) {
        const desiredRoleIds = await this.resolveRolesForGroups(groupIds);
        // Baseline role: every SSO user gets a default role (e.g. viewer) on top of
        // any group-mapped roles, so all employees have at least read access.
        const defaultRoleName = app_config_1.config.directorySync.defaultRoleName;
        if (defaultRoleName) {
            const defaultRole = await prisma_client_1.prisma.role.findFirst({
                where: { name: defaultRoleName },
                select: { id: true },
            });
            if (defaultRole && !desiredRoleIds.includes(defaultRole.id)) {
                desiredRoleIds.push(defaultRole.id);
            }
        }
        const current = (await prisma_client_1.prisma.user_Role.findMany({
            where: { user_id: userId },
            select: { role_id: true, source: true },
        })).map((r) => ({ roleId: r.role_id, source: r.source }));
        const { toAdd, toRemove } = (0, role_reconciler_utility_1.reconcileAdRoles)(current, desiredRoleIds);
        if (toAdd.length === 0 && toRemove.length === 0)
            return;
        await prisma_client_1.prisma.$transaction([
            ...(toRemove.length
                ? [
                    prisma_client_1.prisma.user_Role.deleteMany({
                        where: { user_id: userId, source: 'azure_ad', role_id: { in: toRemove } },
                    }),
                ]
                : []),
            ...toAdd.map((roleId) => prisma_client_1.prisma.user_Role.create({ data: { user_id: userId, role_id: roleId, source: 'azure_ad' } })),
        ]);
        logger_util_1.logger.info('Applied Azure AD roles to user', {
            userId,
            added: toAdd.length,
            removed: toRemove.length,
        });
    }
    async runFullDirectorySync() {
        const directoryUsers = await this.graph.listUsersWithGroups();
        let usersProcessed = 0;
        let deactivated = 0;
        for (const du of directoryUsers) {
            const user = await prisma_client_1.prisma.user.findFirst({
                where: { azure_oid: du.oid, deleted_at: null },
                select: { id: true, is_active: true },
            });
            if (!user)
                continue; // only reconcile users who have logged in at least once
            await this.applyAdRolesToUser(user.id, du.groupIds);
            usersProcessed++;
            if (!du.accountEnabled && user.is_active) {
                await prisma_client_1.prisma.user.update({ where: { id: user.id }, data: { is_active: false } });
                deactivated++;
                logger_util_1.logger.info('Deactivated user disabled in Azure AD', { userId: user.id });
            }
        }
        logger_util_1.logger.info('Directory sync complete', { usersProcessed, deactivated });
        return { usersProcessed, deactivated };
    }
    async _assertExists(id) {
        const m = await prisma_client_1.prisma.directory_Group_Mapping.findUnique({ where: { id } });
        if (!m)
            throw app_error_1.AppError.notFound('Directory group mapping');
    }
}
exports.DirectoryMappingService = DirectoryMappingService;
exports.directoryMappingService = new DirectoryMappingService();
//# sourceMappingURL=directory-mapping.service.js.map