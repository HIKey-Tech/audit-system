export interface PermissionResponseDto {
    id: string;
    name: string;
    module: string;
    action: string;
}
export interface RoleResponseDto {
    id: string;
    name: string;
    description: string | null;
    permissions: PermissionResponseDto[];
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
                permission: {
                    id: string;
                    name: string;
                    module: string;
                    action: string;
                };
            }>;
        };
    }>;
}) => UserResponseDto;
//# sourceMappingURL=user.response.dto.d.ts.map