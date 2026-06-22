export interface DirectoryGroupMapping {
  id: string;
  adGroupId: string;
  adGroupName: string;
  roleId: string;
  roleName?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateMappingInput {
  adGroupId: string;
  adGroupName: string;
  roleId: string;
}

export interface UpdateMappingInput {
  adGroupName?: string;
  roleId?: string;
  isActive?: boolean;
}

export interface IDirectoryMappingService {
  createMapping(dto: CreateMappingInput, actorId: string): Promise<DirectoryGroupMapping>;
  updateMapping(id: string, dto: UpdateMappingInput, actorId: string): Promise<DirectoryGroupMapping>;
  deleteMapping(id: string, actorId: string): Promise<void>;
  listMappings(): Promise<DirectoryGroupMapping[]>;
  resolveRolesForGroups(groupIds: string[]): Promise<string[]>;
  applyAdRolesToUser(userId: string, groupIds: string[]): Promise<void>;
  runFullDirectorySync(): Promise<{ usersProcessed: number; deactivated: number }>;
}
