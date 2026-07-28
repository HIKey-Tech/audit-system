// src/modules/user/dto/response/user.response.dto.ts

export interface PermissionResponseDto {
  id: string;
  slug: string;
  name: string;
  module: string;
  action: string;
}

export interface PermissionListResponseDto {
  id: string;
  slug: string;
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

export interface PermissionGroupResponseDto {
  module: string;
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
  skills: string[];
  maxConcurrentEngagements: number | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: RoleResponseDto[];
  permissions: string[];
}

/**
 * Minimal, non-sensitive user record for people-pickers (assign auditee, add
 * co-responder, pick an owner). Excludes roles/permissions/MFA/tokens. Access is
 * still permission-gated — see the `user:directory` permission.
 */
export interface UserDirectoryDto {
  id: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
}

export const mapUserToDirectory = (u: {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  department: string | null;
  job_title: string | null;
  is_active: boolean;
}): UserDirectoryDto => ({
  id: u.id,
  displayName: u.display_name,
  firstName: u.first_name,
  lastName: u.last_name,
  department: u.department,
  jobTitle: u.job_title,
  isActive: u.is_active,
});

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

/**
 * Result of a password login. Either fully authenticated, or one of the two
 * intermediate 2FA states that require a follow-up call to /auth/2fa/*.
 */
export type LoginResultDto =
  | ({ status: 'OK'; mfaSetupRequired?: boolean } & AuthResponseDto)
  | { status: 'MFA_REQUIRED'; method: 'totp' | 'email'; challengeToken: string }
  | { status: 'MFA_ENROLLMENT_REQUIRED'; enrollmentToken: string };

export interface MfaSetupResponseDto {
  method: 'totp' | 'email';
  // TOTP only — for rendering the QR code / manual-entry key.
  secret?: string;
  otpauthUrl?: string;
  qrDataUrl?: string;
}

export interface MfaEnrollResultDto {
  backupCodes: string[];
  auth: AuthResponseDto;
}

export const mapPermissionToResponse = (permission: {
  id: string;
  slug: string;
  name: string;
  module: string;
  action: string;
  description: string | null;
}): PermissionListResponseDto => ({
  id: permission.id,
  slug: permission.slug,
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
      slug: string;
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
  skills: string | null;
  max_concurrent_engagements: number | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  user_roles: Array<{
    role: {
      id: string;
      name: string;
      description: string | null;
      role_permissions: Array<{
        permission: { id: string; slug: string; name: string; module: string; action: string };
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
      slug: rp.permission.slug,
      name: rp.permission.name,
      module: rp.permission.module,
      action: rp.permission.action,
    })),
  }));

  const permissions = [
    ...new Set(roles.flatMap((r) => r.permissions.map((p) => p.slug))),
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
    skills: parseSkills(user.skills),
    maxConcurrentEngagements: user.max_concurrent_engagements,
    isActive: user.is_active,
    isSuperAdmin: user.is_super_admin,
    lastLoginAt: user.last_login_at?.toISOString() ?? null,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
    roles,
    permissions,
  };
};

function parseSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s: unknown) => typeof s === 'string' && s.length > 0)
      : [];
  } catch {
    return [];
  }
}
