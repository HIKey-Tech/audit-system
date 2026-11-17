export enum AuditType {
  It = 'it',
  Financial = 'financial',
  Compliance = 'compliance',
  Operational = 'operational',
  Pension = 'pension',
  Procurement = 'procurement',
  HrPayroll = 'hr_payroll',
  Project = 'project',
  Special = 'special',
  /** @deprecated Merged into `It` as the System/IT domain. Kept so records
   *  created before the merge still resolve; never offer it as a choice. */
  Systems = 'systems',
}

/** The audit types a user may actually pick. Create/update request DTOs validate
 *  against this rather than the enum, so the retired `systems` value can never
 *  enter on a record. Read-side filters use FILTERABLE_AUDIT_TYPES instead. */
export const SELECTABLE_AUDIT_TYPES = [
  AuditType.It,
  AuditType.Financial,
  AuditType.Compliance,
  AuditType.Operational,
  AuditType.Pension,
  AuditType.Procurement,
  AuditType.HrPayroll,
  AuditType.Project,
  AuditType.Special,
] as const;

export const selectableAuditTypes = SELECTABLE_AUDIT_TYPES;

/** Accepted by query/filter DTOs only: selectable types plus the retired
 *  `systems` alias, so an old bookmarked URL or saved filter still resolves
 *  instead of failing validation. Never use this to accept new data. */
export const FILTERABLE_AUDIT_TYPES = [...SELECTABLE_AUDIT_TYPES, AuditType.Systems] as const;

export enum AuditPriority {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum AuditFrequency {
  Annual = 'annual',
  Biannual = 'biannual',
  Quarterly = 'quarterly',
  Monthly = 'monthly',
  OnDemand = 'on_demand',
}

export enum UniverseCategory {
  Department = 'department',
  System = 'system',
  Process = 'process',
  Asset = 'asset',
  Project = 'project',
}

export enum UniverseStatus {
  Active = 'active',
  Inactive = 'inactive',
}

export enum PlanStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum EngagementStatus {
  Planned = 'planned',
  InProgress = 'in_progress',
  UnderReview = 'under_review',
  Reported = 'reported',
  Closed = 'closed',
}

export enum WorkingPaperStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum FindingCategory {
  It = 'it',
  Financial = 'financial',
  Compliance = 'compliance',
  Systems = 'systems',
  Operational = 'operational',
  Pension = 'pension',
  Procurement = 'procurement',
  HrPayroll = 'hr_payroll',
  Project = 'project',
  Special = 'special',
}

/** Finding categories a user may pick across all audit domains. `systems` is
 *  retired (merged into `it`), so it is deliberately absent. */
export const SELECTABLE_FINDING_CATEGORIES = [
  FindingCategory.It,
  FindingCategory.Financial,
  FindingCategory.Compliance,
  FindingCategory.Operational,
  FindingCategory.Pension,
  FindingCategory.Procurement,
  FindingCategory.HrPayroll,
  FindingCategory.Project,
  FindingCategory.Special,
] as const;

/** Query/filter DTOs only: selectable categories plus the retired `systems`. */
export const FILTERABLE_FINDING_CATEGORIES = [
  ...SELECTABLE_FINDING_CATEGORIES,
  FindingCategory.Systems,
] as const;

export enum FindingSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Informational = 'informational',
}

export enum FindingStatus {
  Open = 'open',
  ManagementResponseReceived = 'management_response_received',
  InRemediation = 'in_remediation',
  Verified = 'verified',
  PendingClosure = 'pending_closure',
  Closed = 'closed',
}

export enum ReportStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Approved = 'approved',
  Rejected = 'rejected',
  Issued = 'issued',
}

export enum VerificationStatus {
  Pending = 'pending',
  Verified = 'verified',
  Rejected = 'rejected',
}

export enum ChecklistResult {
  Passed = 'passed',
  Failed = 'failed',
  NotApplicable = 'not_applicable',
  NotTested = 'not_tested',
}

/**
 * Engagement stages in which the auditee can see their findings: from Quality
 * Assurance (fieldwork finished, draft report being prepared) onward. The
 * management response is collected *before* the report is issued so it can be
 * included in the issued report.
 */
export const AUDITEE_VISIBLE_ENGAGEMENT_STATUSES = [
  EngagementStatus.UnderReview,
  EngagementStatus.Reported,
  EngagementStatus.Closed,
] as const;

/** Stages in which the auditee may still respond to a finding / submit remediation evidence. */
export const AUDITEE_RESPONSE_ENGAGEMENT_STATUSES = [
  EngagementStatus.UnderReview,
  EngagementStatus.Reported,
] as const;
