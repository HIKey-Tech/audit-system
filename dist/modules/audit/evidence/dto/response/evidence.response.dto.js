"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEvidenceToResponse = void 0;
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
//# sourceMappingURL=evidence.response.dto.js.map