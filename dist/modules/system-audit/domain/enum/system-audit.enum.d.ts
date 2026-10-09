export declare enum AnalysisType {
    AccessListing = "access_listing",
    ChangeLog = "change_log",
    BackupLog = "backup_log",
    IncidentLog = "incident_log",
    SecurityEventLog = "security_event_log",
    Configuration = "configuration",
    VulnerabilityScan = "vulnerability_scan",
    DataIntegrity = "data_integrity"
}
/** Where a run's records came from. Every source is read-only. */
export declare enum AnalysisSource {
    Upload = "upload",
    Iams = "iams",
    EntraId = "entra_id",
    Imoc = "imoc"
}
export declare enum RunTrigger {
    Manual = "manual",
    Scheduled = "scheduled"
}
export declare enum RunReviewStatus {
    Open = "open",
    Completed = "completed"
}
export declare enum ExceptionSeverity {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low"
}
export declare enum ExceptionDisposition {
    Open = "open",
    Confirmed = "confirmed",
    FalsePositive = "false_positive",
    Explained = "explained"
}
export declare enum AccessDecision {
    Pending = "pending",
    Appropriate = "appropriate",
    Revoke = "revoke",
    Modify = "modify"
}
export declare enum SecurityTestType {
    VulnerabilityScan = "vulnerability_scan",
    PenetrationTest = "penetration_test",
    WebApplicationTest = "web_application_test",
    RedTeam = "red_team",
    SocialEngineering = "social_engineering"
}
export declare enum SecurityTestStatus {
    Planned = "planned",
    Authorised = "authorised",
    InProgress = "in_progress",
    Reporting = "reporting",
    Remediation = "remediation",
    Closed = "closed",
    Cancelled = "cancelled"
}
export declare enum SecurityTestProviderType {
    Internal = "internal",
    External = "external"
}
export declare enum SystemDocumentType {
    Policy = "policy",
    Procedure = "procedure",
    Standard = "standard",
    ArchitectureDiagram = "architecture_diagram",
    NetworkDiagram = "network_diagram",
    ProcessManual = "process_manual",
    BusinessContinuityPlan = "bcp",
    DisasterRecoveryPlan = "drp",
    IncidentResponsePlan = "incident_response_plan",
    Contract = "contract",
    ServiceLevelAgreement = "sla",
    Other = "other"
}
export declare enum SystemDocumentStatus {
    Active = "active",
    Archived = "archived"
}
//# sourceMappingURL=system-audit.enum.d.ts.map