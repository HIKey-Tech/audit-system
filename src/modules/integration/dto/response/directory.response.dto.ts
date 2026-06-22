import { DirectoryGroupMapping } from '../../service/interface/directory.service.interface';

export interface DirectoryMappingResponse {
  id: string;
  adGroupId: string;
  adGroupName: string;
  roleId: string;
  roleName?: string;
  isActive: boolean;
  createdAt: string;
}

export const mapMappingToResponse = (m: DirectoryGroupMapping): DirectoryMappingResponse => ({
  id: m.id,
  adGroupId: m.adGroupId,
  adGroupName: m.adGroupName,
  roleId: m.roleId,
  roleName: m.roleName,
  isActive: m.isActive,
  createdAt: m.createdAt.toISOString(),
});
