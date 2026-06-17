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

/**
 * Join shape for the centralized evidence repository — pulls the context an
 * auditor needs to recognise a piece of evidence without opening its engagement.
 */
export const evidenceRepositoryInclude = {
  engagement: { select: { reference_number: true, title: true, status: true, audit_type: true } },
  finding: { select: { id: true, title: true } },
  working_paper: { select: { id: true, title: true } },
  uploaded_by: { select: { id: true, first_name: true, last_name: true, display_name: true, email: true } },
  document: { select: { id: true, file_size: true } },
} satisfies Prisma.Audit_EvidenceInclude;

type EvidenceWithContext = Prisma.Audit_EvidenceGetPayload<{ include: typeof evidenceRepositoryInclude }>;

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
  finding: { id: string; title: string } | null;
  workingPaper: { id: string; title: string } | null;
  uploadedBy: { id: string; name: string; email: string };
}

export const mapEvidenceToRepositoryResponse = (
  e: EvidenceWithContext,
): RepositoryEvidenceResponseDto => ({
  id: e.id,
  fileName: e.file_name,
  fileType: e.file_type,
  fileSize: e.document.file_size,
  documentId: e.document_id,
  isDisputed: e.is_disputed,
  disputeReason: e.dispute_reason,
  uploadedAt: e.uploaded_at.toISOString(),
  engagement: {
    id: e.engagement_id,
    referenceNumber: e.engagement.reference_number,
    title: e.engagement.title,
    status: e.engagement.status,
    auditType: e.engagement.audit_type,
  },
  finding: e.finding ? { id: e.finding.id, title: e.finding.title } : null,
  workingPaper: e.working_paper ? { id: e.working_paper.id, title: e.working_paper.title } : null,
  uploadedBy: {
    id: e.uploaded_by.id,
    name: e.uploaded_by.display_name ?? `${e.uploaded_by.first_name} ${e.uploaded_by.last_name}`,
    email: e.uploaded_by.email,
  },
});
