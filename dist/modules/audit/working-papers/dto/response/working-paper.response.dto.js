"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapWpCommentToResponse = exports.wpCommentInclude = exports.mapWorkingPaperToResponse = void 0;
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
// ──────────── Review comments ────────────
const client_1 = require("@prisma/client");
exports.wpCommentInclude = client_1.Prisma.validator()({
    author: { select: { display_name: true, first_name: true, last_name: true } },
    resolved_by: { select: { display_name: true, first_name: true, last_name: true } },
});
const wpUserName = (u) => u ? (u.display_name ?? `${u.first_name} ${u.last_name}`.trim()) : null;
const mapWpCommentToResponse = (c) => ({
    id: c.id,
    workingPaperId: c.working_paper_id,
    authorId: c.author_id,
    authorName: wpUserName(c.author) ?? 'Unknown',
    body: c.body,
    resolvedAt: c.resolved_at?.toISOString() ?? null,
    resolvedByName: wpUserName(c.resolved_by),
    createdAt: c.created_at.toISOString(),
});
exports.mapWpCommentToResponse = mapWpCommentToResponse;
//# sourceMappingURL=working-paper.response.dto.js.map