// src/modules/user/service/interface/user.service.interface.ts
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
} from '../../dto/response/user.response.dto';
import { PaginationMeta } from '../../../../shared/types/api-response.type';

export interface IUserService {
  createUser(
    dto: CreateUserRequestDto,
    actorId: string,
  ): Promise<UserResponseDto>;

  getUserById(id: string): Promise<UserResponseDto>;

  getUserByEmail(email: string): Promise<UserResponseDto>;

  listUsers(
    query: UserQueryDto,
  ): Promise<{ users: UserResponseDto[]; meta: PaginationMeta }>;

  listRoles(
    query: RoleQueryDto,
  ): Promise<{ roles: RoleListResponseDto[]; meta: PaginationMeta }>;

  listPermissions(): Promise<PermissionListResponseDto[]>;

  getRoleById(id: string): Promise<RoleListResponseDto>;

  createRole(dto: CreateRoleRequestDto, actorId: string): Promise<RoleListResponseDto>;

  updateRole(id: string, dto: UpdateRoleRequestDto, actorId: string): Promise<RoleListResponseDto>;

  deleteRole(id: string, actorId: string): Promise<void>;

  replaceRolePermissions(
    id: string,
    dto: ReplaceRolePermissionsRequestDto,
    actorId: string,
  ): Promise<RoleListResponseDto>;

  listPermissionsGroupedByModule(): Promise<PermissionGroupResponseDto[]>;

  updateUser(
    id: string,
    dto: UpdateUserRequestDto,
    actorId: string,
  ): Promise<UserResponseDto>;

  setUserActiveStatus(
    id: string,
    isActive: boolean,
    actorId: string,
  ): Promise<UserResponseDto>;

  deleteUser(id: string, actorId: string): Promise<void>;

  assignRoles(
    userId: string,
    dto: AssignRoleRequestDto,
    actorId: string,
  ): Promise<UserResponseDto>;

  removeRole(userId: string, roleId: string, actorId: string): Promise<UserResponseDto>;

  changePassword(
    userId: string,
    dto: ChangePasswordRequestDto,
  ): Promise<void>;

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
  groupsOverage?: boolean; // true when Azure omitted groups due to the >150/200 limit
}
