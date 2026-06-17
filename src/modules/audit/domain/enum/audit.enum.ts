export enum AuditType {
  It = 'it',
  Financial = 'financial',
  Compliance = 'compliance',
  Systems = 'systems',
}

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
}

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
