import { api } from '../api-client';

// ============================================================
// Azure AD directory group → IAMS role mappings
// ============================================================
export interface DirectoryMappingDto {
  id: string;
  adGroupId: string;
  adGroupName: string;
  roleId: string;
  roleName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateDirectoryMappingDto {
  adGroupId: string;
  adGroupName: string;
  roleId: string;
}

export interface UpdateDirectoryMappingDto {
  adGroupName?: string;
  roleId?: string;
  isActive?: boolean;
}

export interface DirectorySyncResult {
  usersProcessed: number;
  deactivated: number;
}

export const directoryApi = {
  list: () => api.get<DirectoryMappingDto[]>('/integration/directory/mappings'),
  create: (dto: CreateDirectoryMappingDto) =>
    api.post<DirectoryMappingDto>('/integration/directory/mappings', dto),
  update: (id: string, dto: UpdateDirectoryMappingDto) =>
    api.patch<DirectoryMappingDto>(`/integration/directory/mappings/${id}`, dto),
  remove: (id: string) => api.delete(`/integration/directory/mappings/${id}`),
  syncNow: () => api.post<DirectorySyncResult>('/integration/directory/sync'),
};
