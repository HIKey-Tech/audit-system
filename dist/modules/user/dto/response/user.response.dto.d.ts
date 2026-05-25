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
    isActive: boolean;
    isSuperAdmin: boolean;
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