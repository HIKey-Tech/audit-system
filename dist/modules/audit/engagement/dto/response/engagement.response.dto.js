"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEngagementToResponse = void 0;
const universe_response_dto_1 = require("../../../universe/dto/response/universe.response.dto");
const mapEngagementToResponse = (engagement, extras) => ({
    id: engagement.id,
    referenceNumber: engagement.reference_number,
    title: engagement.title,
    universeId: engagement.universe_id,
    planItemId: engagement.plan_item_id,
    auditType: engagement.audit_type,
    status: engagement.status,
    priority: engagement.priority,
    leadAuditorId: engagement.lead_auditor_id,
    auditManagerId: engagement.audit_manager_id,
    auditeeId: engagement.auditee_id,
    plannedStartDate: engagement.planned_start_date.toISOString(),
    plannedEndDate: engagement.planned_end_date.toISOString(),
    actualStartDate: engagement.actual_start_date?.toISOString() ?? null,
    actualEndDate: engagement.actual_end_date?.toISOString() ?? null,
    slaDeadline: engagement.sla_deadline.toISOString(),
    isAdhoc: engagement.is_adhoc,
    adhocReason: engagement.adhoc_reason,
    createdById: engagement.created_by_id,
    createdAt: engagement.created_at.toISOString(),
    updatedAt: engagement.updated_at.toISOString(),
    universe: engagement.universe ? (0, universe_response_dto_1.mapUniverseToResponse)(engagement.universe) : undefined,
    findingCounts: extras?.findingCounts,
    workingPaperCount: extras?.workingPaperCount,
    checklistProgress: extras?.checklistProgress,
});
exports.mapEngagementToResponse = mapEngagementToResponse;
//# sourceMappingURL=engagement.response.dto.js.map