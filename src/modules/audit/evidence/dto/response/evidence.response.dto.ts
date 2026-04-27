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

export const mapEvidenceToResponse = (evidence: {
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
}): EvidenceResponseDto => ({
  id: evidence.id,
  engagementId: evidence.engagement_id,
  workingPaperId: evidence.working_paper_id,
  findingId: evidence.finding_id,
  documentId: evidence.document_id,
  fileName: evidence.file_name,
  fileType: evidence.file_type,
  uploadedById: evidence.uploaded_by_id,
  isDisputed: evidence.is_disputed,
  disputeReason: evidence.dispute_reason,
  uploadedAt: evidence.uploaded_at.toISOString(),
  createdAt: evidence.created_at.toISOString(),
});
