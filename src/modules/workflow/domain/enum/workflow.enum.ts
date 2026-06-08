export enum WorkflowEntityType {
  AuditPlan = 'audit_plan',
  AuditWorkingPaper = 'audit_working_paper',
  AuditReport = 'audit_report',
}

export enum WorkflowApprovalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum WorkflowApprovalStepStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum WorkflowAssignmentRole {
  LeadAuditor = 'lead_auditor',
  SupportingAuditor = 'supporting_auditor',
}

export enum WorkflowEscalationEntityType {
  AuditEngagement = 'audit_engagement',
  WorkflowApproval = 'workflow_approval',
  WorkflowRequest = 'workflow_request',
}

export enum WorkflowEscalationReason {
  SlaBreach = 'sla_breach',
  ApprovalInaction = 'approval_inaction',
}

export enum EscalationPolicyAuditType {
  It = 'it',
  Financial = 'financial',
  Compliance = 'compliance',
  Systems = 'systems',
  All = 'all',
}
