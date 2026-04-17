// src/modules/user/service/interface/user.service.interface.ts
import {
  CreateUserRequestDto,
  UpdateUserRequestDto,
  AssignRoleRequestDto,
  ChangePasswordRequestDto,
  UserQueryDto,
} from '../../dto/request/user.request.dto'
import { UserResponseDto } from '../../dto/response/user.response.dto';
import { ApiResponse, PaginationMeta } from '../../../../shared/types/api-response.type';

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

  updateUser(
    id: string,
    dto: UpdateUserRequestDto,
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
}