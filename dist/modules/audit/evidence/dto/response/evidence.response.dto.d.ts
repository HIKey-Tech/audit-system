import { Prisma } from '@prisma/client';
export interface EvidenceResponseDto {
    id: string;
    engagementId: string;
    workingPaperId: string | null;
    findingId: string | null;
    documentId: string;
    fileName: string;
    fileType: string;
    uploadedById: string;
    isDisputed: boolean;
    disputeReason: string | null;
    uploadedAt: string;
    createdAt: string;
}
export declare const mapEvidenceToResponse: (evidence: {
    id: string;
    engagement_id: string;
    working_paper_id: string | null;
    finding_id: string | null;
    document_id: string;
    file_name: string;
    file_type: string;
    uploaded_by_id: string;
    is_disputed: boolean;
    dispute_reason: string | null;
    uploaded_at: Date;
    created_at: Date;
}) => EvidenceResponseDto;
/**
 * Join shape for the centralized evidence repository — pulls the context an
 * auditor needs to recognise a piece of evidence without opening its engagement.
 */
export declare const evidenceRepositoryInclude: {
    engagement: {
        select: {
            reference_number: true;
            title: true;
            status: true;
            audit_type: true;
        };
    };
    finding: {
        select: {
            id: true;
            title: true;
        };
    };
    working_paper: {
        select: {
            id: true;
            title: true;
        };
    };
    uploaded_by: {
        select: {
            id: true;
            first_name: true;
            last_name: true;
            display_name: true;
            email: true;
        };
    };
    document: {
        select: {
            id: true;
            file_size: true;
        };
    };
};
type EvidenceWithContext = Prisma.Audit_EvidenceGetPayload<{
    include: typeof evidenceRepositoryInclude;
}>;
export interface RepositoryEvidenceResponseDto {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    documentId: string;
    isDisputed: boolean;
    disputeReason: string | null;
    uploadedAt: string;
    engagement: {
        id: string;
        referenceNumber: string;
        title: string;
        status: string;
        auditType: string;
    };
    finding: {
        id: string;
        title: string;
    } | null;
    workingPaper: {
        id: string;
        title: string;
    } | null;
    uploadedBy: {
        id: string;
        name: string;
        email: string;
    };
}
export declare const mapEvidenceToRepositoryResponse: (e: EvidenceWithContext) => RepositoryEvidenceResponseDto;
export {};
//# sourceMappingURL=evidence.response.dto.d.ts.map