"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEscalationPolicyToResponse = exports.mapEscalationToResponse = void 0;
const approval_response_dto_1 = require("../../../approval/dto/response/approval.response.dto");
const mapEscalationToResponse = (escalation) => ({
    id: escalation.id,
    entityType: escalation.entity_type,
    entityId: escalation.entity_id,
    escalationLevel: escalation.escalation_level,
    escalatedToId: escalation.escalated_to_id,
    reason: escalation.reason,
    notifiedAt: escalation.notified_at.toISOString(),
    acknowledgedAt: escalation.acknowledged_at?.toISOString() ?? null,
    createdAt: escalation.created_at.toISOString(),
    escalatedTo: escalation.escalated_to ? (0, approval_response_dto_1.mapWorkflowUserBrief)(escalation.escalated_to) : undefined,
});
exports.mapEscalationToResponse = mapEscalationToResponse;
const mapEscalationPolicyToResponse = (policy) => ({
    id: policy.id,
    auditType: policy.audit_type,
    level1Hours: policy.level_1_hours,
    level2Hours: policy.level_2_hours,
    level3Hours: policy.level_3_hours,
    level4Hours: policy.level_4_hours,
    isActive: policy.is_active,
    createdById: policy.created_by_id,
    createdAt: policy.created_at.toISOString(),
    updatedAt: policy.updated_at.toISOString(),
});
exports.mapEscalationPolicyToResponse = mapEscalationPolicyToResponse;
//# sourceMappingURL=escalation.response.dto.js.map