// SQL Server has no native enums; these mirror the string columns documented
// in the SYSTEM AUDIT TOOLKIT block of prisma/schema.prisma.

export enum AnalysisType {
  AccessListing = 'access_listing',
  ChangeLog = 'change_log',
  BackupLog = 'backup_log',
  IncidentLog = 'incident_log',
  SecurityEventLog = 'security_event_log',
  Configuration = 'configuration',
  VulnerabilityScan = 'vulnerability_scan',
  DataIntegrity = 'data_integrity',
}

/** Where a run's records came from. Every source is read-only. */
export enum AnalysisSource {
  Upload = 'upload',
  Iams = 'iams',
  EntraId = 'entra_id',
  Imoc = 'imoc',
}

export enum RunTrigger {
  Manual = 'manual',
  Scheduled = 'scheduled',
}

export enum RunReviewStatus {
  Open = 'open',
  Completed = 'completed',
}

export enum ExceptionSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum ExceptionDisposition {
  Open = 'open',
  Confirmed = 'confirmed',
  FalsePositive = 'false_positive',
  Explained = 'explained',
}

export enum AccessDecision {
  Pending = 'pending',
  Appropriate = 'appropriate',
  Revoke = 'revoke',
  Modify = 'modify',
}

export enum SecurityTestType {
  VulnerabilityScan = 'vulnerability_scan',
  PenetrationTest = 'penetration_test',
  WebApplicationTest = 'web_application_test',
  RedTeam = 'red_team',
  SocialEngineering = 'social_engineering',
}

export enum SecurityTestStatus {
  Planned = 'planned',
  Authorised = 'authorised',
  InProgress = 'in_progress',
  Reporting = 'reporting',
  Remediation = 'remediation',
  Closed = 'closed',
  Cancelled = 'cancelled',
}

export enum SecurityTestProviderType {
  Internal = 'internal',
  External = 'external',
}

export enum SystemDocumentType {
  Policy = 'policy',
  Procedure = 'procedure',
  Standard = 'standard',
  ArchitectureDiagram = 'architecture_diagram',
  NetworkDiagram = 'network_diagram',
  ProcessManual = 'process_manual',
  BusinessContinuityPlan = 'bcp',
  DisasterRecoveryPlan = 'drp',
  IncidentResponsePlan = 'incident_response_plan',
  Contract = 'contract',
  ServiceLevelAgreement = 'sla',
  Other = 'other',
}

export enum SystemDocumentStatus {
  Active = 'active',
  Archived = 'archived',
}
