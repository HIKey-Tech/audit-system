// src/modules/user/service/implementation/user.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { config } from '../../../../shared/config/app.config';
import { logger } from '../../../../shared/utils/logger.util';
import { PaginationMeta, parsePagination, buildPaginationMeta } from '../../../../shared/types/api-response.type';
import { INotificationQueueService } from '../../../messaging/service/interface/notification-queue.service.interface';
import { notificationQueueService } from '../../../messaging/service/implementation/notification-queue.service';
import {
  IUserService,
  AzureAdProfile,
} from '../interface/user.service.interface';
import {
  CreateUserRequestDto,
  UpdateUserRequestDto,
  AssignRoleRequestDto,
  ChangePasswordRequestDto,
  UserQueryDto,
  RoleQueryDto,
  CreateRoleRequestDto,
  UpdateRoleRequestDto,
  ReplaceRolePermissionsRequestDto,
} from '../../dto/request/user.request.dto';
import {
  UserResponseDto,
  RoleListResponseDto,
  PermissionListResponseDto,
  PermissionGroupResponseDto,
  mapUserToResponse,
  mapRoleToResponse,
  mapPermissionToResponse,
} from '../../dto/response/user.response.dto';
import { hashPassword, comparePassword, generateTemporaryPassword } from '../../utility/token.utility';
import { userWithRolesInclude, UserWithRoles } from '../../../../shared/prisma/prisma.types';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
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

export class UserService implements IUserService {
  constructor(
    private readonly notificationQueue: INotificationQueueService = notificationQueueService,
  ) {}

  async createUser(
    dto: CreateUserRequestDto,
    actorId: string,
  ): Promise<UserResponseDto> {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw AppError.conflict(`User with email '${dto.email}' already exists`);
    }

    const assignedRoles = dto.roleIds?.length
      ? await prisma.role.findMany({ where: { id: { in: dto.roleIds } } })
      : [];

    if (dto.roleIds?.length && assignedRoles.length !== dto.roleIds.length) {
      throw AppError.badRequest('One or more role IDs are invalid');
    }

    const initialPassword = dto.password ?? generateTemporaryPassword();
    const password_hash = await hashPassword(initialPassword);

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        first_name: dto.firstName,
        last_name: dto.lastName,
        display_name: dto.displayName ?? `${dto.firstName} ${dto.lastName}`,
        phone: dto.phone,
        department: dto.department,
        job_title: dto.jobTitle,
        ...(dto.skills && { skills: JSON.stringify(dto.skills) }),
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
      include: userWithRolesInclude,
    }) as UserWithRoles;

    logger.info('User created', { userId: user.id, actorId });
    await this._sendOnboardingEmail(user, initialPassword);
    return mapUserToResponse(user);
  }

  async getUserById(id: string): Promise<UserResponseDto> {
    const user = await prisma.user.findUnique({
      where: { id, deleted_at: null },
      include: userWithRolesInclude,
    }) as UserWithRoles | null;

    if (!user) throw AppError.notFound('User');
    return mapUserToResponse(user);
  }

  async getUserByEmail(email: string): Promise<UserResponseDto> {
    const user = await prisma.user.findUnique({
      where: { email, deleted_at: null },
      include: userWithRolesInclude,
    }) as UserWithRoles | null;

    if (!user) throw AppError.notFound('User');
    return mapUserToResponse(user);
  }

  async listUsers(
    query: UserQueryDto,
  ): Promise<{ users: UserResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where: Prisma.UserWhereInput = {
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

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: userWithRolesInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      users: (users as UserWithRoles[]).map(mapUserToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async listRoles(
    query: RoleQueryDto,
  ): Promise<{ roles: RoleListResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const [total, roles] = await prisma.$transaction([
      prisma.role.count(),
      prisma.role.findMany({
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
      roles: roles.map(mapRoleToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async listPermissions(): Promise<PermissionListResponseDto[]> {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { action: 'asc' },
        { slug: 'asc' },
      ],
    });

    return permissions.map(mapPermissionToResponse);
  }

  async getRoleById(id: string): Promise<RoleListResponseDto> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        role_permissions: {
          include: { permission: true },
          orderBy: { permission: { slug: 'asc' } },
        },
      },
    });

    if (!role) throw AppError.notFound('Role');
    return mapRoleToResponse(role);
  }

  async createRole(
    dto: CreateRoleRequestDto,
    actorId: string,
  ): Promise<RoleListResponseDto> {
    const existing = await prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw AppError.conflict(`Role with name '${dto.name}' already exists`);
    }

    await this._assertPermissionsExist(dto.permissionIds ?? []);

    const role = await prisma.role.create({
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

    logger.info('Role created', { roleId: role.id, actorId });
    return mapRoleToResponse(role);
  }

  async updateRole(
    id: string,
    dto: UpdateRoleRequestDto,
    actorId: string,
  ): Promise<RoleListResponseDto> {
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Role');

    if (dto.name && dto.name !== existing.name) {
      const nameOwner = await prisma.role.findUnique({ where: { name: dto.name } });
      if (nameOwner) {
        throw AppError.conflict(`Role with name '${dto.name}' already exists`);
      }
    }

    const role = await prisma.role.update({
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

    logger.info('Role updated', { roleId: id, actorId });
    return mapRoleToResponse(role);
  }

  async deleteRole(id: string, actorId: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { id },
      select: { id: true, is_system: true },
    });
    if (!role) throw AppError.notFound('Role');

    if (role.is_system) {
      throw AppError.badRequest('System roles cannot be deleted');
    }

    const assignedUsers = await prisma.user_Role.count({ where: { role_id: id } });
    if (assignedUsers > 0) {
      throw AppError.conflict('Role cannot be deleted while assigned to users');
    }

    await prisma.role.delete({ where: { id } });
    logger.info('Role deleted', { roleId: id, actorId });
  }

  async replaceRolePermissions(
    id: string,
    dto: ReplaceRolePermissionsRequestDto,
    actorId: string,
  ): Promise<RoleListResponseDto> {
    const role = await prisma.role.findUnique({ where: { id }, select: { id: true } });
    if (!role) throw AppError.notFound('Role');

    await this._assertPermissionsExist(dto.permissionIds);

    await prisma.$transaction([
      prisma.role_Permission.deleteMany({ where: { role_id: id } }),
      prisma.role_Permission.createMany({
        data: dto.permissionIds.map((permissionId) => ({
          role_id: id,
          permission_id: permissionId,
        })),
      }),
    ]);

    logger.info('Role permissions replaced', {
      roleId: id,
      permissionIds: dto.permissionIds,
      actorId,
    });
    return this.getRoleById(id);
  }

  async listPermissionsGroupedByModule(): Promise<PermissionGroupResponseDto[]> {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { action: 'asc' },
        { slug: 'asc' },
      ],
    });

    const grouped = new Map<string, PermissionListResponseDto[]>();
    for (const permission of permissions) {
      const current = grouped.get(permission.module) ?? [];
      current.push(mapPermissionToResponse(permission));
      grouped.set(permission.module, current);
    }

    return [...grouped.entries()].map(([module, modulePermissions]) => ({
      module,
      permissions: modulePermissions,
    }));
  }

  async updateUser(
    id: string,
    dto: UpdateUserRequestDto,
    actorId: string,
  ): Promise<UserResponseDto> {
    await this._assertUserExists(id);

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName && { first_name: dto.firstName }),
        ...(dto.lastName && { last_name: dto.lastName }),
        ...(dto.displayName !== undefined && { display_name: dto.displayName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.jobTitle !== undefined && { job_title: dto.jobTitle }),
        ...(dto.skills !== undefined && { skills: dto.skills ? JSON.stringify(dto.skills) : null }),
      },
      include: userWithRolesInclude,
    }) as UserWithRoles;

    logger.info('User updated', { userId: id, actorId });
    return mapUserToResponse(user);
  }

  async setUserActiveStatus(
    id: string,
    isActive: boolean,
    actorId: string,
  ): Promise<UserResponseDto> {
    await this._assertUserExists(id);

    if (id === actorId && !isActive) {
      throw AppError.badRequest('You cannot deactivate your own account');
    }

    const user = await prisma.user.update({
      where: { id },
      data: { is_active: isActive },
      include: userWithRolesInclude,
    }) as UserWithRoles;

    logger.info(isActive ? 'User activated' : 'User deactivated', {
      userId: id,
      actorId,
    });
    return mapUserToResponse(user);
  }

  async deleteUser(id: string, actorId: string): Promise<void> {
    await this._assertUserExists(id);

    if (id === actorId) {
      throw AppError.badRequest('You cannot delete your own account');
    }

    await prisma.user.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });

    logger.info('User soft-deleted', { userId: id, actorId });
  }

  async assignRoles(
    userId: string,
    dto: AssignRoleRequestDto,
    actorId: string,
  ): Promise<UserResponseDto> {
    await this._assertUserExists(userId);

    // Verify all roles exist
    const roles = await prisma.role.findMany({
      where: { id: { in: dto.roleIds } },
    });

    if (roles.length !== dto.roleIds.length) {
      throw AppError.badRequest('One or more role IDs are invalid');
    }

    // Upsert each role assignment
    await prisma.$transaction(
      dto.roleIds.map((roleId) =>
        prisma.user_Role.upsert({
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
        }),
      ),
    );

    logger.info('Roles assigned', { userId, roleIds: dto.roleIds, actorId });
    await this._syncUserSuperAdminFlag(userId);
    return this.getUserById(userId);
  }

  async removeRole(
    userId: string,
    roleId: string,
    actorId: string,
  ): Promise<UserResponseDto> {
    await prisma.user_Role.deleteMany({
      where: { user_id: userId, role_id: roleId },
    });

    logger.info('Role removed from user', { userId, roleId, actorId });
    await this._syncUserSuperAdminFlag(userId);
    return this.getUserById(userId);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordRequestDto,
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId, deleted_at: null },
      select: { password_hash: true },
    });

    if (!user) throw AppError.notFound('User');

    if (!user.password_hash) {
      throw AppError.badRequest(
        'Password change is not available for SSO-only accounts',
      );
    }

    const currentValid = await comparePassword(
      dto.currentPassword,
      user.password_hash,
    );
    if (!currentValid) {
      throw AppError.badRequest('Current password is incorrect');
    }

    const newHash = await hashPassword(dto.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });

    logger.info('Password changed', { userId });
  }

  async syncFromAzureAd(
    azureOid: string,
    profile: AzureAdProfile,
  ): Promise<UserResponseDto> {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ azure_oid: azureOid }, { email: profile.email }],
        deleted_at: null,
      },
      include: userWithRolesInclude,
    });

    if (existing) {
      // Sync latest profile data from IdP
      const updated = await prisma.user.update({
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
        include: userWithRolesInclude,
      });

      logger.info('User synced from Azure AD', { userId: existing.id });
      return mapUserToResponse(updated);
    }

    // JIT provisioning: create on first SSO login
    const defaultRole = await prisma.role.findFirst({
      where: { name: 'viewer' },
    });

    const created = await prisma.user.create({
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
      include: userWithRolesInclude,
    });

    logger.info('User JIT-provisioned from Azure AD', { userId: created.id });
    return mapUserToResponse(created);
  }

  private async _assertUserExists(id: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id, deleted_at: null },
      select: { id: true },
    });
    if (!user) throw AppError.notFound('User');
  }

  private async _assertPermissionsExist(permissionIds: string[]): Promise<void> {
    if (permissionIds.length === 0) return;

    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    });

    if (permissions.length !== permissionIds.length) {
      throw AppError.badRequest('One or more permission IDs are invalid');
    }
  }

  private async _syncUserSuperAdminFlag(userId: string): Promise<void> {
    const superAdminRole = await prisma.user_Role.findFirst({
      where: {
        user_id: userId,
        role: { name: 'super_admin' },
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { is_super_admin: Boolean(superAdminRole) },
    });
  }

  private async _sendOnboardingEmail(
    user: UserWithRoles,
    temporaryPassword: string,
  ): Promise<void> {
    const displayName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
    const loginUrl = `${config.app.url.replace(/\/$/, '')}/login`;
    const appName = config.app.name;

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
    });
  }
}
