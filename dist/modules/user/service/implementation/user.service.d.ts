import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IUserService, AzureAdProfile } from '../interface/user.service.interface';
import { CreateUserRequestDto, UpdateUserRequestDto, AssignRoleRequestDto, ChangePasswordRequestDto, UserQueryDto, RoleQueryDto } from '../../dto/request/user.request.dto';
import { UserResponseDto, RoleListResponseDto, PermissionListResponseDto } from '../../dto/response/user.response.dto';
export declare class UserService implements IUserService {
    createUser(dto: CreateUserRequestDto, actorId: string): Promise<UserResponseDto>;
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
    updateUser(id: string, dto: UpdateUserRequestDto, actorId: string): Promise<UserResponseDto>;
    deleteUser(id: string, actorId: string): Promise<void>;
    assignRoles(userId: string, dto: AssignRoleRequestDto, actorId: string): Promise<UserResponseDto>;
    removeRole(userId: string, roleId: string, actorId: string): Promise<UserResponseDto>;
    changePassword(userId: string, dto: ChangePasswordRequestDto): Promise<void>;
    syncFromAzureAd(azureOid: string, profile: AzureAdProfile): Promise<UserResponseDto>;
    private _assertUserExists;
}
//# sourceMappingURL=user.service.d.ts.map