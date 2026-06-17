"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationPolicyAuditType = exports.WorkflowEscalationReason = exports.WorkflowEscalationEntityType = exports.WorkflowAssignmentRole = exports.WorkflowApprovalStepStatus = exports.WorkflowApprovalStatus = exports.WorkflowEntityType = void 0;
var WorkflowEntityType;
(function (WorkflowEntityType) {
    WorkflowEntityType["AuditPlan"] = "audit_plan";
    WorkflowEntityType["AuditWorkingPaper"] = "audit_working_paper";
    WorkflowEntityType["AuditReport"] = "audit_report";
    WorkflowEntityType["AuditFindingClosure"] = "audit_finding_closure";
})(WorkflowEntityType || (exports.WorkflowEntityType = WorkflowEntityType = {}));
var WorkflowApprovalStatus;
(function (WorkflowApprovalStatus) {
    WorkflowApprovalStatus["Pending"] = "pending";
    WorkflowApprovalStatus["Approved"] = "approved";
    WorkflowApprovalStatus["Rejected"] = "rejected";
    WorkflowApprovalStatus["Cancelled"] = "cancelled";
})(WorkflowApprovalStatus || (exports.WorkflowApprovalStatus = WorkflowApprovalStatus = {}));
var WorkflowApprovalStepStatus;
(function (WorkflowApprovalStepStatus) {
    WorkflowApprovalStepStatus["Pending"] = "pending";
    WorkflowApprovalStepStatus["Approved"] = "approved";
    WorkflowApprovalStepStatus["Rejected"] = "rejected";
})(WorkflowApprovalStepStatus || (exports.WorkflowApprovalStepStatus = WorkflowApprovalStepStatus = {}));
var WorkflowAssignmentRole;
(function (WorkflowAssignmentRole) {
    WorkflowAssignmentRole["LeadAuditor"] = "lead_auditor";
    WorkflowAssignmentRole["SupportingAuditor"] = "supporting_auditor";
})(WorkflowAssignmentRole || (exports.WorkflowAssignmentRole = WorkflowAssignmentRole = {}));
var WorkflowEscalationEntityType;
(function (WorkflowEscalationEntityType) {
    WorkflowEscalationEntityType["AuditEngagement"] = "audit_engagement";
    WorkflowEscalationEntityType["WorkflowApproval"] = "workflow_approval";
    WorkflowEscalationEntityType["WorkflowRequest"] = "workflow_request";
})(WorkflowEscalationEntityType || (exports.WorkflowEscalationEntityType = WorkflowEscalationEntityType = {}));
var WorkflowEscalationReason;
(function (WorkflowEscalationReason) {
    WorkflowEscalationReason["SlaBreach"] = "sla_breach";
    WorkflowEscalationReason["ApprovalInaction"] = "approval_inaction";
})(WorkflowEscalationReason || (exports.WorkflowEscalationReason = WorkflowEscalationReason = {}));
var EscalationPolicyAuditType;
(function (EscalationPolicyAuditType) {
    EscalationPolicyAuditType["It"] = "it";
    EscalationPolicyAuditType["Financial"] = "financial";
    EscalationPolicyAuditType["Compliance"] = "compliance";
    EscalationPolicyAuditType["Systems"] = "systems";
    EscalationPolicyAuditType["All"] = "all";
})(EscalationPolicyAuditType || (exports.EscalationPolicyAuditType = EscalationPolicyAuditType = {}));
//# sourceMappingURL=workflow.enum.js.map