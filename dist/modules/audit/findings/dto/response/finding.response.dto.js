"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFindingToResponse = void 0;
const evidence_response_dto_1 = require("../../../evidence/dto/response/evidence.response.dto");
const follow_up_response_dto_1 = require("../../../follow-up/dto/response/follow-up.response.dto");
const mapFindingToResponse = (finding) => ({
    id: finding.id,
    engagementId: finding.engagement_id,
    workingPaperId: finding.working_paper_id,
    title: finding.title,
    description: finding.description,
    category: finding.category,
    severity: finding.severity,
    rootCause: finding.root_cause,
    riskImplication: finding.risk_implication,
    recommendation: finding.recommendation,
    auditeeId: finding.auditee_id,
    status: finding.status,
    dueDate: finding.due_date.toISOString(),
    createdById: finding.created_by_id,
    closedById: finding.closed_by_id,
    closedAt: finding.closed_at?.toISOString() ?? null,
    createdAt: finding.created_at.toISOString(),
    updatedAt: finding.updated_at.toISOString(),
    evidence: finding.evidence?.map(evidence_response_dto_1.mapEvidenceToResponse),
    followUp: finding.follow_up === undefined ? undefined : finding.follow_up ? (0, follow_up_response_dto_1.mapFollowUpToResponse)(finding.follow_up) : null,
});
exports.mapFindingToResponse = mapFindingToResponse;
//# sourceMappingURL=finding.response.dto.js.map