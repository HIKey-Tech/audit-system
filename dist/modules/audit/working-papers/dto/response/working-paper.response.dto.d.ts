import { EvidenceResponseDto, mapEvidenceToResponse } from '../../../evidence/dto/response/evidence.response.dto';
export interface WorkingPaperResponseDto {
    id: string;
    engagementId: string;
    title: string;
    content: string;
    versionNumber: number;
    status: string;
    createdById: string;
    reviewedById: string | null;
    rejectionReason: string | null;
    createdAt: string;
    updatedAt: string;
    evidence?: EvidenceResponseDto[];
}
export declare const mapWorkingPaperToResponse: (paper: {
    id: string;
    engagement_id: string;
    title: string;
    content: string;
    version_number: number;
    status: string;
    created_by_id: string;
    reviewed_by_id: string | null;
    rejection_reason: string | null;
    created_at: Date;
    updated_at: Date;
    evidence?: Array<Parameters<typeof mapEvidenceToResponse>[0]>;
}) => WorkingPaperResponseDto;
//# sourceMappingURL=working-paper.response.dto.d.ts.map