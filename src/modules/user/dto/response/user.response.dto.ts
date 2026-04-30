// src/modules/user/dto/response/user.response.dto.ts

export interface PermissionResponseDto {
  id: string;
  name: string;
  module: string;
  action: string;
}

export interface PermissionListResponseDto {
  id: string;
  name: string;
  module: string;
  action: string;
  description: string | null;
}

export interface RoleResponseDto {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionResponseDto[];
}

export interface RoleListResponseDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionListResponseDto[];
}

export interface UserResponseDto {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: RoleResponseDto[];
  permissions: string[];
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: UserResponseDto;
}

export interface SsoRedirectResponseDto {
  authorizationUrl: string;
  state: string;
}

export const mapPermissionToResponse = (permission: {
  id: string;
  name: string;
  module: string;
  action: string;
  description: string | null;
}): PermissionListResponseDto => ({
  id: permission.id,
  name: permission.name,
  module: permission.module,
  action: permission.action,
  description: permission.description,
});

export const mapRoleToResponse = (role: {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  role_permissions: Array<{
    permission: {
      id: string;
      name: string;
      module: string;
      action: string;
      description: string | null;
    };
  }>;
}): RoleListResponseDto => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystem: role.is_system,
  permissions: role.role_permissions.map((rp) => mapPermissionToResponse(rp.permission)),
});

// Mapper: Prisma model → Response DTO
export const mapUserToResponse = (user: {
  id: string;
  email: string;
  email_verified: boolean;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  user_roles: Array<{
    role: {
      id: string;
      name: string;
      description: string | null;
      role_permissions: Array<{
        permission: { id: string; name: string; module: string; action: string };
      }>;
    };
  }>;
}): UserResponseDto => {
  const roles: RoleResponseDto[] = user.user_roles.map((ur) => ({
    id: ur.role.id,
    name: ur.role.name,
    description: ur.role.description,
    permissions: ur.role.role_permissions.map((rp) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      module: rp.permission.module,
      action: rp.permission.action,
    })),
  }));

  const permissions = [
    ...new Set(roles.flatMap((r) => r.permissions.map((p) => p.name))),
  ];

  return {
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    phone: user.phone,
    department: user.department,
    jobTitle: user.job_title,
    isActive: user.is_active,
    lastLoginAt: user.last_login_at?.toISOString() ?? null,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
    roles,
    permissions,
  };
};
