import type { UserWithRoles } from '../../../../shared/prisma/prisma.types';
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
/**
 * Effective access of one account — roles and the permissions they grant — for
 * read-only user access reviews. Expired role assignments are excluded.
 */
export interface UserAccessEntitlementDto {
    id: string;
    email: string;
    displayName: string;
    department: string | null;
    jobTitle: string | null;
    isActive: boolean;
    isSuperAdmin: boolean;
    mfaEnabled: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    roles: string[];
    roleSources: Record<string, string>;
    permissions: string[];
}
export declare const mapUserToAccessEntitlement: (user: UserWithRoles, now?: Date) => UserAccessEntitlementDto;
export interface UserDirectoryDto {
    id: string;
    displayName: string | null;
    firstName: string;
    lastName: string;
    department: string | null;
    jobTitle: string | null;
    isActive: boolean;
}
export declare const mapUserToDirectory: (u: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    department: string | null;
    job_title: string | null;
    is_active: boolean;
}) => UserDirectoryDto;
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
export type LoginResultDto = ({
    status: 'OK';
    mfaSetupRequired?: boolean;
} & AuthResponseDto) | {
    status: 'MFA_REQUIRED';
    method: 'totp' | 'email';
    challengeToken: string;
} | {
    status: 'MFA_ENROLLMENT_REQUIRED';
    enrollmentToken: string;
};
export interface MfaSetupResponseDto {
    method: 'totp' | 'email';
    secret?: string;
    otpauthUrl?: string;
    qrDataUrl?: string;
}
export interface MfaEnrollResultDto {
    backupCodes: string[];
    auth: AuthResponseDto;
}
export declare const mapPermissionToResponse: (permission: {
    id: string;
    slug: string;
    name: string;
    module: string;
    action: string;
    description: string | null;
}) => PermissionListResponseDto;
export declare const mapRoleToResponse: (role: {
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
}) => RoleListResponseDto;
export declare const mapUserToResponse: (user: {
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
                permission: {
                    id: string;
                    slug: string;
                    name: string;
                    module: string;
                    action: string;
                };
            }>;
        };
    }>;
}) => UserResponseDto;
//# sourceMappingURL=user.response.dto.d.ts.map