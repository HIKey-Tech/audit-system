"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRiskAssessmentToResponse = void 0;
const mapUserBrief = (user) => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    firstName: user.first_name,
    lastName: user.last_name,
});
const mapRiskAssessmentToResponse = (assessment) => ({
    id: assessment.id,
    riskId: assessment.risk_id,
    likelihood: assessment.likelihood,
    impact: assessment.impact,
    score: assessment.score,
    notes: assessment.notes,
    assessedById: assessment.assessed_by_id,
    assessedBy: assessment.assessed_by ? mapUserBrief(assessment.assessed_by) : undefined,
    assessedAt: assessment.assessed_at.toISOString(),
    createdAt: assessment.created_at.toISOString(),
});
exports.mapRiskAssessmentToResponse = mapRiskAssessmentToResponse;
//# sourceMappingURL=assessment.response.dto.js.map