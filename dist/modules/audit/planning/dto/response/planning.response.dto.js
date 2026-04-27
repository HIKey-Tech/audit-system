"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPlanToResponse = exports.mapPlanItemToResponse = void 0;
const universe_response_dto_1 = require("../../../universe/dto/response/universe.response.dto");
const mapPlanItemToResponse = (item) => ({
    id: item.id,
    planId: item.plan_id,
    universeId: item.universe_id,
    auditType: item.audit_type,
    plannedStartDate: item.planned_start_date.toISOString(),
    plannedEndDate: item.planned_end_date.toISOString(),
    priority: item.priority,
    engagementCreated: item.engagement_created,
    createdAt: item.created_at.toISOString(),
    updatedAt: item.updated_at.toISOString(),
    universe: item.universe ? (0, universe_response_dto_1.mapUniverseToResponse)(item.universe) : undefined,
});
exports.mapPlanItemToResponse = mapPlanItemToResponse;
const mapPlanToResponse = (plan, warnings) => ({
    id: plan.id,
    title: plan.title,
    year: plan.year,
    status: plan.status,
    createdById: plan.created_by_id,
    approvedById: plan.approved_by_id,
    approvedAt: plan.approved_at?.toISOString() ?? null,
    rejectionReason: plan.rejection_reason,
    createdAt: plan.created_at.toISOString(),
    updatedAt: plan.updated_at.toISOString(),
    items: plan.items?.map(exports.mapPlanItemToResponse),
    warnings,
});
exports.mapPlanToResponse = mapPlanToResponse;
//# sourceMappingURL=planning.response.dto.js.map