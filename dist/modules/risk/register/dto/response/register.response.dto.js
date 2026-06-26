"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRiskRegisterToResponse = void 0;
const assessment_response_dto_1 = require("../../../assessments/dto/response/assessment.response.dto");
const category_response_dto_1 = require("../../../categories/dto/response/category.response.dto");
const mapRiskUserToResponse = (user) => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    firstName: user.first_name,
    lastName: user.last_name,
    department: user.department,
    jobTitle: user.job_title,
});
const mapRiskRegisterToResponse = (risk) => ({
    id: risk.id,
    title: risk.title,
    description: risk.description,
    categoryId: risk.category_id,
    category: risk.category ? (0, category_response_dto_1.mapRiskCategoryToResponse)(risk.category) : undefined,
    ownerId: risk.owner_id,
    owner: risk.owner ? mapRiskUserToResponse(risk.owner) : undefined,
    likelihood: risk.likelihood,
    impact: risk.impact,
    currentScore: risk.current_score,
    status: risk.status,
    lastAssessedAt: risk.last_assessed_at?.toISOString() ?? null,
    universeId: risk.universe_id,
    universeName: risk.universe?.name ?? null,
    createdById: risk.created_by_id,
    latestAssessment: risk.assessments?.[0]
        ? (0, assessment_response_dto_1.mapRiskAssessmentToResponse)(risk.assessments[0])
        : risk.assessments
            ? null
            : undefined,
    createdAt: risk.created_at.toISOString(),
    updatedAt: risk.updated_at.toISOString(),
});
exports.mapRiskRegisterToResponse = mapRiskRegisterToResponse;
//# sourceMappingURL=register.response.dto.js.map