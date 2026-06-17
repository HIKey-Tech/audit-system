"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEngagementToResponse = void 0;
const universe_response_dto_1 = require("../../../universe/dto/response/universe.response.dto");
const fullName = (user) => {
    if (!user)
        return null;
    return user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim() || null;
};
const mapEngagementToResponse = (engagement, extras) => ({
    id: engagement.id,
    referenceNumber: engagement.reference_number,
    title: engagement.title,
    universeId: engagement.universe_id,
    planItemId: engagement.plan_item_id,
    planTitle: engagement.plan_item?.plan?.title ?? null,
    auditType: engagement.audit_type,
    status: engagement.status,
    priority: engagement.priority,
    leadAuditorId: engagement.lead_auditor_id,
    auditManagerId: engagement.audit_manager_id,
    auditeeId: engagement.auditee_id,
    leadAuditorName: fullName(engagement.lead_auditor),
    auditManagerName: fullName(engagement.audit_manager),
    auditeeName: fullName(engagement.auditee),
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
    workingPaperStats: extras?.workingPaperStats,
    findingStats: extras?.findingStats,
    reportStatus: extras?.reportStatus,
    evidenceCount: extras?.evidenceCount,
    assetCount: extras?.assetCount,
});
exports.mapEngagementToResponse = mapEngagementToResponse;
//# sourceMappingURL=engagement.response.dto.js.map