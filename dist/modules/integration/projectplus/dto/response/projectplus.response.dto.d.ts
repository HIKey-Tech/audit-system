import { Projectplus_Entity_Link } from '@prisma/client';
export interface ProjectPlusEntityLinkResponseDto {
    id: string;
    engagementId: string;
    customerType: string;
    referenceCode: string;
    fullName: string;
    entityType: string | null;
    entitySubType: string | null;
    rcNumber: string | null;
    tin: string | null;
    lastStatus: string | null;
    lastSyncedAt: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export declare const mapProjectPlusLinkToResponse: (l: Projectplus_Entity_Link) => ProjectPlusEntityLinkResponseDto;
//# sourceMappingURL=projectplus.response.dto.d.ts.map