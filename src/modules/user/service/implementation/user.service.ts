// src/modules/user/service/implementation/user.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { PaginationMeta, parsePagination, buildPaginationMeta } from '../../../../shared/types/api-response.type';
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
} from '../../dto/request/user.request.dto';
import {
  UserResponseDto,
  mapUserToResponse,
} from '../../dto/response/user.response.dto';
import { hashPassword, comparePassword } from '../../utility/token.utility';
import { userWithRolesInclude, UserWithRoles } from '../../../../shared/prisma/prisma.types';


export class UserService implements IUserService {
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

    const password_hash = dto.password
      ? await hashPassword(dto.password)
      : null;

    const user = await prisma.user.create({
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
      include: userWithRolesInclude,
    }) as UserWithRoles;

    logger.info('User created', { userId: user.id, actorId });
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
      }) as Promise<UserWithRoles[]>,
    ]);

    return {
      users: users.map(mapUserToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
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
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
      },
      include: userWithRolesInclude,
    }) as UserWithRoles;

    logger.info('User updated', { userId: id, actorId });
    return mapUserToResponse(user);
  }

  async deleteUser(id: string, actorId: string): Promise<void> {
    await this._assertUserExists(id);

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
}