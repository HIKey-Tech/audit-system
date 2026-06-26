import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { INotificationQueueService } from '../../../messaging/service/interface/notification-queue.service.interface';
import { IUserService, AzureAdProfile, RoleManagementActor } from '../interface/user.service.interface';
import { CreateUserRequestDto, UpdateUserRequestDto, AssignRoleRequestDto, ChangePasswordRequestDto, UserQueryDto, RoleQueryDto, CreateRoleRequestDto, UpdateRoleRequestDto, ReplaceRolePermissionsRequestDto } from '../../dto/request/user.request.dto';
import { UserResponseDto, RoleListResponseDto, PermissionListResponseDto, PermissionGroupResponseDto } from '../../dto/response/user.response.dto';
export declare class UserService implements IUserService {
    private readonly notificationQueue;
    constructor(notificationQueue?: INotificationQueueService);
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
    /**
     * Applies Azure AD group→role mappings to a user on SSO login. Falls back
     * to a Microsoft Graph lookup when the token omitted groups (overage).
     * Never throws — a role-sync failure must not block login.
     */
    private _applyDirectoryRoles;
    /**
     * Least-privilege guard for granting/removing roles. A super admin may manage
     * any role. Everyone else:
     *   - may never grant or remove the `super_admin` role, and
     *   - may only assign roles whose permission set is a subset of their own
     *     (you cannot hand out authority you do not hold — blocks self/lateral
     *     privilege escalation through `role:assign` / `user:create`).
     */
    private _assertCanGrantRoles;
    private _assertUserExists;
    private _assertPermissionsExist;
    private _syncUserSuperAdminFlag;
    private _sendOnboardingEmail;
}
//# sourceMappingURL=user.service.d.ts.map