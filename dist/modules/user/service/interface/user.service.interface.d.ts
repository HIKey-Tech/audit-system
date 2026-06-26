import { CreateUserRequestDto, UpdateUserRequestDto, AssignRoleRequestDto, ChangePasswordRequestDto, UserQueryDto, RoleQueryDto, CreateRoleRequestDto, UpdateRoleRequestDto, ReplaceRolePermissionsRequestDto } from '../../dto/request/user.request.dto';
import { UserResponseDto, RoleListResponseDto, PermissionListResponseDto, PermissionGroupResponseDto } from '../../dto/response/user.response.dto';
import { PaginationMeta } from '../../../../shared/types/api-response.type';
/**
 * Actor context for privileged operations that can change a user's authority.
 * Carries the actor's own permissions/super-admin flag so role grants can be
 * checked against the least-privilege rule (you cannot grant authority you do
 * not hold; only super admins may grant super admin).
 */
export interface RoleManagementActor {
    id: string;
    isSuperAdmin: boolean;
    permissions: string[];
}
export interface IUserService {
    createUser(dto: CreateUserRequestDto, actor: RoleManagementActor): Promise<UserResponseDto>;
    getUserById(id: string): Promise<UserResponseDto>;
    getUserByEmail(email: string): Promise<UserResponseDto>;
    listUsers(query: UserQueryDto): Promise<{
        users: UserResponseDto[];
        meta: PaginationMeta;
    }>;
    listRoles(query: RoleQueryDto): Promise<{
        roles: RoleListResponseDto[];
        meta: PaginationMeta;
    }>;
    listPermissions(): Promise<PermissionListResponseDto[]>;
    getRoleById(id: string): Promise<RoleListResponseDto>;
    createRole(dto: CreateRoleRequestDto, actorId: string): Promise<RoleListResponseDto>;
    updateRole(id: string, dto: UpdateRoleRequestDto, actorId: string): Promise<RoleListResponseDto>;
    deleteRole(id: string, actorId: string): Promise<void>;
    replaceRolePermissions(id: string, dto: ReplaceRolePermissionsRequestDto, actorId: string): Promise<RoleListResponseDto>;
    listPermissionsGroupedByModule(): Promise<PermissionGroupResponseDto[]>;
    updateUser(id: string, dto: UpdateUserRequestDto, actorId: string): Promise<UserResponseDto>;
    setUserActiveStatus(id: string, isActive: boolean, actorId: string): Promise<UserResponseDto>;
    deleteUser(id: string, actorId: string): Promise<void>;
    assignRoles(userId: string, dto: AssignRoleRequestDto, actor: RoleManagementActor): Promise<UserResponseDto>;
    removeRole(userId: string, roleId: string, actor: RoleManagementActor): Promise<UserResponseDto>;
    changePassword(userId: string, dto: ChangePasswordRequestDto): Promise<void>;
    syncFromAzureAd(azureOid: string, profile: AzureAdProfile): Promise<UserResponseDto>;
}
export interface AzureAdProfile {
    oid: string;
    email: string;
    givenName?: string;
    familyName?: string;
    displayName?: string;
    jobTitle?: string;
    department?: string;
    mobilePhone?: string;
    groups?: string[];
    groupsOverage?: boolean;
    authMethods?: string[];
    emailVerified?: boolean;
}
//# sourceMappingURL=user.service.interface.d.ts.map