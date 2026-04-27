"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFollowUpToResponse = void 0;
const evidence_response_dto_1 = require("../../../evidence/dto/response/evidence.response.dto");
const mapFollowUpToResponse = (followUp) => ({
    id: followUp.id,
    findingId: followUp.finding_id,
    managementResponse: followUp.management_response,
    managementResponseById: followUp.management_response_by_id,
    managementResponseAt: followUp.management_response_at?.toISOString() ?? null,
    remediationEvidenceId: followUp.remediation_evidence_id,
    verificationStatus: followUp.verification_status,
    verifiedById: followUp.verified_by_id,
    verifiedAt: followUp.verified_at?.toISOString() ?? null,
    verificationNotes: followUp.verification_notes,
    createdAt: followUp.created_at.toISOString(),
    updatedAt: followUp.updated_at.toISOString(),
    finding: followUp.finding
        ? {
            id: followUp.finding.id,
            engagementId: followUp.finding.engagement_id,
            title: followUp.finding.title,
            severity: followUp.finding.severity,
            status: followUp.finding.status,
            auditeeId: followUp.finding.auditee_id,
            dueDate: followUp.finding.due_date.toISOString(),
        }
        : undefined,
    remediationEvidence: followUp.remediation_evidence === undefined
        ? undefined
        : followUp.remediation_evidence
            ? (0, evidence_response_dto_1.mapEvidenceToResponse)(followUp.remediation_evidence)
            : null,
});
exports.mapFollowUpToResponse = mapFollowUpToResponse;
//# sourceMappingURL=follow-up.response.dto.js.map