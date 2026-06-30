import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import { AppError } from '../../../../shared/errors/app.error';
import { auditLogService } from '../../../logging/service/implementation/audit-log.service';
import { reconcileAdRoles, CurrentUserRole } from '../../utility/role-reconciler.utility';
import {
  createGraphDirectoryClient,
  IGraphDirectoryClient,
} from '../client/graph.client';
import {
  IDirectoryMappingService,
  DirectoryGroupMapping,
  CreateMappingInput,
  UpdateMappingInput,
} from '../interface/directory.service.interface';

const toMapping = (m: {
  id: string;
  ad_group_id: string;
  ad_group_name: string;
  role_id: string;
  is_active: boolean;
  created_at: Date;
  role?: { name: string } | null;
}): DirectoryGroupMapping => ({
  id: m.id,
  adGroupId: m.ad_group_id,
  adGroupName: m.ad_group_name,
  roleId: m.role_id,
  roleName: m.role?.name,
  isActive: m.is_active,
  createdAt: m.created_at,
});

export class DirectoryMappingService implements IDirectoryMappingService {
  constructor(private readonly graph: IGraphDirectoryClient = createGraphDirectoryClient()) {}

  async createMapping(dto: CreateMappingInput, actorId: string): Promise<DirectoryGroupMapping> {
    const role = await prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw AppError.badRequest('roleId does not reference a known role');

    const existing = await prisma.directory_Group_Mapping.findFirst({
      where: { ad_group_id: dto.adGroupId, role_id: dto.roleId },
    });
    if (existing) throw AppError.conflict('This group is already mapped to this role');

    const created = await prisma.directory_Group_Mapping.create({
      data: {
        ad_group_id: dto.adGroupId,
        ad_group_name: dto.adGroupName,
        role_id: dto.roleId,
        created_by: actorId,
      },
      include: { role: true },
    });
    auditLogService.logAsync({
      userId: actorId,
      module: 'integration',
      action: 'directory_mapping.create',
      entityType: 'directory_group_mapping',
      entityId: created.id,
      status: 'success',
    });
    logger.info('Directory group mapping created', { actorId, id: created.id });
    return toMapping(created);
  }

  async updateMapping(id: string, dto: UpdateMappingInput, actorId: string): Promise<DirectoryGroupMapping> {
    await this._assertExists(id);
    if (dto.roleId) {
      const role = await prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw AppError.badRequest('roleId does not reference a known role');

      const current = await prisma.directory_Group_Mapping.findUnique({
        where: { id },
        select: { ad_group_id: true },
      });
      if (!current) throw AppError.notFound('Directory group mapping');

      const duplicate = await prisma.directory_Group_Mapping.findFirst({
        where: {
          id: { not: id },
          ad_group_id: current.ad_group_id,
          role_id: dto.roleId,
        },
        select: { id: true },
      });
      if (duplicate) throw AppError.conflict('This group is already mapped to this role');
    }
    const updated = await prisma.directory_Group_Mapping.update({
      where: { id },
      data: {
        ad_group_name: dto.adGroupName,
        role_id: dto.roleId,
        is_active: dto.isActive,
      },
      include: { role: true },
    });
    auditLogService.logAsync({
      userId: actorId,
      module: 'integration',
      action: 'directory_mapping.update',
      entityType: 'directory_group_mapping',
      entityId: id,
      status: 'success',
    });
    return toMapping(updated);
  }

  async deleteMapping(id: string, actorId: string): Promise<void> {
    await this._assertExists(id);
    await prisma.directory_Group_Mapping.delete({ where: { id } });
    auditLogService.logAsync({
      userId: actorId,
      module: 'integration',
      action: 'directory_mapping.delete',
      entityType: 'directory_group_mapping',
      entityId: id,
      status: 'success',
    });
  }

  async listMappings(): Promise<DirectoryGroupMapping[]> {
    const rows = await prisma.directory_Group_Mapping.findMany({
      include: { role: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toMapping);
  }

  async resolveRolesForGroups(groupIds: string[]): Promise<string[]> {
    if (groupIds.length === 0) return [];
    const mappings = await prisma.directory_Group_Mapping.findMany({
      where: { is_active: true, ad_group_id: { in: groupIds } },
      select: { role_id: true },
    });
    return [...new Set(mappings.map((m) => m.role_id))];
  }

  async applyAdRolesToUser(userId: string, groupIds: string[]): Promise<void> {
    const desiredRoleIds = await this.resolveRolesForGroups(groupIds);

    // Baseline role: every SSO user gets a default role (e.g. viewer) on top of
    // any group-mapped roles, so all employees have at least read access.
    const defaultRoleName = config.directorySync.defaultRoleName;
    if (defaultRoleName) {
      const defaultRole = await prisma.role.findFirst({
        where: { name: defaultRoleName },
        select: { id: true },
      });
      if (defaultRole && !desiredRoleIds.includes(defaultRole.id)) {
        desiredRoleIds.push(defaultRole.id);
      }
    }

    const current: CurrentUserRole[] = (
      await prisma.user_Role.findMany({
        where: { user_id: userId },
        select: { role_id: true, source: true },
      })
    ).map((r) => ({ roleId: r.role_id, source: r.source }));

    const { toAdd, toRemove } = reconcileAdRoles(current, desiredRoleIds);
    if (toAdd.length === 0 && toRemove.length === 0) return;

    await prisma.$transaction([
      ...(toRemove.length
        ? [
            prisma.user_Role.deleteMany({
              where: { user_id: userId, source: 'azure_ad', role_id: { in: toRemove } },
            }),
          ]
        : []),
      ...toAdd.map((roleId) =>
        prisma.user_Role.create({ data: { user_id: userId, role_id: roleId, source: 'azure_ad' } }),
      ),
    ]);
    logger.info('Applied Azure AD roles to user', {
      userId,
      added: toAdd.length,
      removed: toRemove.length,
    });
  }

  async runFullDirectorySync(): Promise<{ usersProcessed: number; deactivated: number }> {
    const directoryUsers = await this.graph.listUsersWithGroups();
    let usersProcessed = 0;
    let deactivated = 0;

    for (const du of directoryUsers) {
      const user = await prisma.user.findFirst({
        where: { azure_oid: du.oid, deleted_at: null },
        select: { id: true, is_active: true },
      });
      if (!user) continue; // only reconcile users who have logged in at least once

      await this.applyAdRolesToUser(user.id, du.groupIds);
      usersProcessed++;

      if (!du.accountEnabled && user.is_active) {
        await prisma.user.update({ where: { id: user.id }, data: { is_active: false } });
        deactivated++;
        logger.info('Deactivated user disabled in Azure AD', { userId: user.id });
      }
    }
    logger.info('Directory sync complete', { usersProcessed, deactivated });
    return { usersProcessed, deactivated };
  }

  private async _assertExists(id: string): Promise<void> {
    const m = await prisma.directory_Group_Mapping.findUnique({ where: { id } });
    if (!m) throw AppError.notFound('Directory group mapping');
  }
}

export const directoryMappingService = new DirectoryMappingService();
