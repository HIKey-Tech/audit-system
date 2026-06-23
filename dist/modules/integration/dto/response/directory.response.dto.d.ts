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
export declare const mapMappingToResponse: (m: DirectoryGroupMapping) => DirectoryMappingResponse;
//# sourceMappingURL=directory.response.dto.d.ts.map