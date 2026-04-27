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
//# sourceMappingURL=evidence.response.dto.d.ts.map