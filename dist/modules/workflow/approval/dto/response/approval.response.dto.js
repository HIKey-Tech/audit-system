"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapApprovalToResponse = exports.mapApprovalStepToResponse = exports.mapWorkflowUserBrief = void 0;
const mapWorkflowUserBrief = (user) => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name ?? `${user.first_name} ${user.last_name}`,
    firstName: user.first_name,
    lastName: user.last_name,
    department: user.department,
    jobTitle: user.job_title,
});
exports.mapWorkflowUserBrief = mapWorkflowUserBrief;
const mapApprovalStepToResponse = (step) => ({
    id: step.id,
    approvalId: step.approval_id,
    level: step.level,
    approverId: step.approver_id,
    status: step.status,
    comment: step.comment,
    actedAt: step.acted_at?.toISOString() ?? null,
    createdAt: step.created_at.toISOString(),
    approver: step.approver ? (0, exports.mapWorkflowUserBrief)(step.approver) : undefined,
});
exports.mapApprovalStepToResponse = mapApprovalStepToResponse;
const mapApprovalToResponse = (approval) => ({
    id: approval.id,
    entityType: approval.entity_type,
    entityId: approval.entity_id,
    submittedById: approval.submitted_by_id,
    currentLevel: approval.current_level,
    status: approval.status,
    rejectionReason: approval.rejection_reason,
    completedAt: approval.completed_at?.toISOString() ?? null,
    createdAt: approval.created_at.toISOString(),
    updatedAt: approval.updated_at.toISOString(),
    submittedBy: approval.submitted_by ? (0, exports.mapWorkflowUserBrief)(approval.submitted_by) : undefined,
    steps: approval.steps?.map(exports.mapApprovalStepToResponse),
});
exports.mapApprovalToResponse = mapApprovalToResponse;
//# sourceMappingURL=approval.response.dto.js.map