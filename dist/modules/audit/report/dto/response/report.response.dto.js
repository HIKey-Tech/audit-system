"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapReportToResponse = void 0;
const finding_response_dto_1 = require("../../../findings/dto/response/finding.response.dto");
const mapReportToResponse = (report) => ({
    id: report.id,
    engagementId: report.engagement_id,
    engagementReference: report.engagement?.reference_number,
    title: report.title,
    executiveSummary: report.executive_summary,
    scope: report.scope,
    methodology: report.methodology,
    status: report.status,
    version: report.version_number,
    versionNumber: report.version_number,
    documentId: report.document_id,
    issuedAt: report.issued_at?.toISOString() ?? null,
    rejectionReason: report.rejection_reason,
    createdById: report.created_by_id,
    createdAt: report.created_at.toISOString(),
    updatedAt: report.updated_at.toISOString(),
    findings: report.engagement?.findings.map(finding_response_dto_1.mapFindingToResponse),
});
exports.mapReportToResponse = mapReportToResponse;
//# sourceMappingURL=report.response.dto.js.map