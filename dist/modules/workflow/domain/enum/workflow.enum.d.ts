export declare enum WorkflowEntityType {
    AuditPlan = "audit_plan",
    AuditWorkingPaper = "audit_working_paper",
    AuditReport = "audit_report"
}
export declare enum WorkflowApprovalStatus {
    Pending = "pending",
    Approved = "approved",
    Rejected = "rejected",
    Cancelled = "cancelled"
}
export declare enum WorkflowApprovalStepStatus {
    Pending = "pending",
    Approved = "approved",
    Rejected = "rejected"
}
export declare enum WorkflowAssignmentRole {
    LeadAuditor = "lead_auditor",
    SupportingAuditor = "supporting_auditor"
}
export declare enum WorkflowEscalationEntityType {
    AuditEngagement = "audit_engagement",
    WorkflowApproval = "workflow_approval"
}
export declare enum WorkflowEscalationReason {
    SlaBreach = "sla_breach",
    ApprovalInaction = "approval_inaction"
}
export declare enum EscalationPolicyAuditType {
    It = "it",
    Financial = "financial",
    Compliance = "compliance",
    Systems = "systems",
    All = "all"
}
//# sourceMappingURL=workflow.enum.d.ts.map