"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFindingToResponse = void 0;
const evidence_response_dto_1 = require("../../../evidence/dto/response/evidence.response.dto");
const follow_up_response_dto_1 = require("../../../follow-up/dto/response/follow-up.response.dto");
const formatUserName = (user) => {
    if (!user)
        return undefined;
    const name = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
    return name || user.email;
};
const mapFindingToResponse = (finding) => ({
    id: finding.id,
    engagementId: finding.engagement_id,
    engagementReference: finding.engagement?.reference_number,
    workingPaperId: finding.working_paper_id,
    checklistId: finding.checklist_id,
    controlReference: finding.checklist?.control_reference,
    controlDescription: finding.checklist?.control_description,
    riskId: finding.risk_id,
    riskTitle: finding.risk?.title,
    title: finding.title,
    description: finding.description,
    category: finding.category,
    severity: finding.severity,
    rootCause: finding.root_cause,
    riskImplication: finding.risk_implication,
    recommendation: finding.recommendation,
    auditeeId: finding.auditee_id,
    auditeeName: formatUserName(finding.auditee),
    status: finding.status,
    dueDate: finding.due_date.toISOString(),
    createdById: finding.created_by_id,
    createdByName: formatUserName(finding.created_by),
    closedById: finding.closed_by_id,
    closedAt: finding.closed_at?.toISOString() ?? null,
    createdAt: finding.created_at.toISOString(),
    updatedAt: finding.updated_at.toISOString(),
    evidence: finding.evidence?.map(evidence_response_dto_1.mapEvidenceToResponse),
    followUp: finding.follow_up === undefined ? undefined : finding.follow_up ? (0, follow_up_response_dto_1.mapFollowUpToResponse)(finding.follow_up) : null,
});
exports.mapFindingToResponse = mapFindingToResponse;
//# sourceMappingURL=finding.response.dto.js.map