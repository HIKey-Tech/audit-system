"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEvidenceToRepositoryResponse = exports.evidenceRepositoryInclude = exports.mapEvidenceToResponse = void 0;
const mapEvidenceToResponse = (evidence) => ({
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
exports.mapEvidenceToResponse = mapEvidenceToResponse;
/**
 * Join shape for the centralized evidence repository — pulls the context an
 * auditor needs to recognise a piece of evidence without opening its engagement.
 */
exports.evidenceRepositoryInclude = {
    engagement: { select: { reference_number: true, title: true, status: true, audit_type: true } },
    finding: { select: { id: true, title: true } },
    working_paper: { select: { id: true, title: true } },
    uploaded_by: { select: { id: true, first_name: true, last_name: true, display_name: true, email: true } },
    document: { select: { id: true, file_size: true } },
};
const mapEvidenceToRepositoryResponse = (e) => ({
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
exports.mapEvidenceToRepositoryResponse = mapEvidenceToRepositoryResponse;
//# sourceMappingURL=evidence.response.dto.js.map