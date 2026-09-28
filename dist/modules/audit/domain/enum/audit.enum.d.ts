export declare enum AuditType {
    It = "it",
    Financial = "financial",
    Compliance = "compliance",
    /** @deprecated Merged into `It` as the System/IT domain. Kept so records
     *  created before the merge still resolve; never offer it as a choice. */
    Systems = "systems"
}
/** The audit types a user may actually pick. Request DTOs validate against this
 *  rather than the enum, so the retired `systems` value can never enter on a
 *  new record while existing rows still read correctly. */
export declare const SELECTABLE_AUDIT_TYPES: readonly [AuditType.It, AuditType.Financial, AuditType.Compliance];
export declare enum AuditPriority {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low"
}
export declare enum AuditFrequency {
    Annual = "annual",
    Biannual = "biannual",
    Quarterly = "quarterly",
    Monthly = "monthly"
}
export declare enum UniverseCategory {
    Department = "department",
    System = "system",
    Process = "process",
    Asset = "asset",
    Project = "project"
}
export declare enum UniverseStatus {
    Active = "active",
    Inactive = "inactive"
}
export declare enum PlanStatus {
    Draft = "draft",
    Submitted = "submitted",
    Approved = "approved",
    Rejected = "rejected"
}
export declare enum EngagementStatus {
    Planned = "planned",
    InProgress = "in_progress",
    UnderReview = "under_review",
    Reported = "reported",
    Closed = "closed"
}
export declare enum WorkingPaperStatus {
    Draft = "draft",
    Submitted = "submitted",
    Approved = "approved",
    Rejected = "rejected"
}
export declare enum FindingCategory {
    It = "it",
    Financial = "financial",
    Compliance = "compliance",
    /** @deprecated Merged into `It`. See AuditType.Systems. */
    Systems = "systems",
    Operational = "operational"
}
/** Finding categories a user may pick — `systems` is retired, see AuditType. */
export declare const SELECTABLE_FINDING_CATEGORIES: readonly [FindingCategory.It, FindingCategory.Financial, FindingCategory.Compliance, FindingCategory.Operational];
export declare enum FindingSeverity {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low",
    Informational = "informational"
}
export declare enum FindingStatus {
    Open = "open",
    ManagementResponseReceived = "management_response_received",
    InRemediation = "in_remediation",
    Verified = "verified",
    PendingClosure = "pending_closure",
    Closed = "closed"
}
export declare enum ReportStatus {
    Draft = "draft",
    Submitted = "submitted",
    Approved = "approved",
    Rejected = "rejected",
    Issued = "issued"
}
export declare enum VerificationStatus {
    Pending = "pending",
    Verified = "verified",
    Rejected = "rejected"
}
export declare enum ChecklistResult {
    Passed = "passed",
    Failed = "failed",
    NotApplicable = "not_applicable",
    NotTested = "not_tested"
}
//# sourceMappingURL=audit.enum.d.ts.map