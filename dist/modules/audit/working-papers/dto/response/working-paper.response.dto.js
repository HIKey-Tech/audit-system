"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapWorkingPaperToResponse = void 0;
const evidence_response_dto_1 = require("../../../evidence/dto/response/evidence.response.dto");
const mapWorkingPaperToResponse = (paper) => ({
    id: paper.id,
    engagementId: paper.engagement_id,
    templateId: paper.template_id,
    sourceDocumentId: paper.source_document_id,
    workingPaperType: paper.working_paper_type,
    title: paper.title,
    content: paper.content,
    versionNumber: paper.version_number,
    status: paper.status,
    createdById: paper.created_by_id,
    reviewedById: paper.reviewed_by_id,
    rejectionReason: paper.rejection_reason,
    importMetadata: paper.import_metadata ? JSON.parse(paper.import_metadata) : null,
    createdAt: paper.created_at.toISOString(),
    updatedAt: paper.updated_at.toISOString(),
    evidence: paper.evidence?.map(evidence_response_dto_1.mapEvidenceToResponse),
});
exports.mapWorkingPaperToResponse = mapWorkingPaperToResponse;
//# sourceMappingURL=working-paper.response.dto.js.map