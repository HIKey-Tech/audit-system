import { api } from '../api-client';
import type { UserDto, RoleListDto, PermissionDto } from '../types/domain';
import type { PaginatedResult } from '../types/api';

export interface UsersListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  roleId?: string;
  department?: string;
}

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  password?: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
  skills?: string[];
  roleIds?: string[];
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
  skills?: string[];
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export const usersApi = {
  list: (query?: UsersListQuery) =>
    api.getPaginated<UserDto>('/users', query as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<UserDto>(`/users/${id}`),
  me: () => api.get<UserDto>('/users/me'),
  updateMe: (dto: UpdateUserDto) => api.patch<UserDto>('/users/me', dto),
  changePassword: (dto: ChangePasswordDto) =>
    api.post<void>('/users/me/change-password', dto),
  create: (dto: CreateUserDto) => api.post<UserDto>('/users', dto),
  update: (id: string, dto: UpdateUserDto) => api.patch<UserDto>(`/users/${id}`, dto),
  activate: (id: string) => api.post<UserDto>(`/users/${id}/activate`, {}),
  deactivate: (id: string) => api.post<UserDto>(`/users/${id}/deactivate`, {}),
  remove: (id: string) => api.delete(`/users/${id}`),
  getRoles: () => api.get<RoleListDto[]>('/users/roles'),
  getPermissions: () => api.get<PermissionDto[]>('/users/permissions'),
  assignRoles: (userId: string, roleIds: string[]) =>
    api.put<UserDto>(`/users/${userId}/roles`, { roleIds }),
  removeRole: (userId: string, roleId: string) =>
    api.delete(`/users/${userId}/roles/${roleId}`),
};
