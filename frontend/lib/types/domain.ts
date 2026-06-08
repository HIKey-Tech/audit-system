// Mirror of backend response DTOs used across the frontend.
// Keep in sync with src/modules/**/dto/response/*.dto.ts in the backend.

// ============================================================
// Auth / User
// ============================================================
export interface PermissionDto {
  id: string;
  name: string;
  module: string;
  action: string;
}

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionDto[];
}

export interface RoleListDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<PermissionDto & { description: string | null }>;
}

export interface UserDto {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  skills: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: RoleDto[];
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: UserDto;
}

// ============================================================
// Dashboard
// ============================================================
export interface AuditSummary {
  totalEngagementsThisYear: number;
  byStatus: {
    planned: number;
    in_progress: number;
    under_review: number;
    reported: number;
    closed: number;
  };
  overdueEngagements: number;
  dueSoon: number;
  completionRate: number;
  totalPlansThisYear: number;
  approvedPlans: number;
}

export interface FindingsSummary {
  totalOpen: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  byStatus: {
    open: number;
    management_response_received: number;
    in_remediation: number;
    verified: number;
    closed: number;
  };
  overdue: number;
  averageDaysToClose: number | null;
  resolvedThisMonth: number;
}

export interface TopRiskItem {
  id: string;
  title: string;
  score: number;
  status: string;
  categoryName: string;
  ownerName: string;
}

export interface RiskOverview {
  totalRisks: number;
  byScoreBand: { critical: number; high: number; medium: number; low: number };
  byStatus: { open: number; mitigated: number; accepted: number; closed: number };
  topFiveRisks: TopRiskItem[];
  staleRisks: number;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  status: string;
  userId: string | null;
  createdAt: string;
}

export interface RecentEscalationItem {
  id: string;
  entityType: string;
  entityId: string;
  escalationLevel: number;
  reason: string;
  notifiedUserName: string;
  notifiedAt: string;
}

export interface EscalationOverview {
  totalActive: number;
  byLevel: { level1: number; level2: number; level3: number; level4: number };
  recentEscalations: RecentEscalationItem[];
}

export interface MyEngagementItem {
  id: string;
  title: string;
  referenceNumber: string;
  status: string;
  slaDeadline: string;
  priority: string;
}

export interface MyPendingApprovalItem {
  stepId: string;
  approvalId: string;
  entityType: string;
  entityId: string;
  currentLevel: number;
  createdAt: string;
}

export interface MyFindingToVerify {
  id: string;
  title: string;
  severity: string;
  status: string;
  dueDate: string;
  engagementId: string;
  engagementReference: string;
}

export interface MyWork {
  myActiveEngagements: MyEngagementItem[];
  myPendingApprovals: MyPendingApprovalItem[];
  myOverdueEngagements: MyEngagementItem[];
  myFindingsToVerify: MyFindingToVerify[];
}

export interface ApprovalInboxSummary {
  pendingCount: number;
  oldestPendingDays: number;
  requestPendingCount: number;
}

export interface AuditAnalytics {
  generatedAt: string;
  lifecycle: {
    byStatus: AuditSummary['byStatus'];
    overdueEngagements: number;
    dueSoon: number;
    averageCycleDays: number | null;
    averageFieldworkDays: number | null;
    averageReportingDays: number | null;
  };
  workingPapers: {
    total: number;
    imported: number;
    byStatus: Record<string, number>;
    submittedAwaitingReview: number;
  };
  findings: FindingsSummary;
  reporting: {
    total: number;
    byStatus: Record<string, number>;
    averageDaysToIssue: number | null;
  };
  followUp: {
    total: number;
    pending: number;
    verified: number;
    rejected: number;
    overdueFindings: number;
  };
  riskCoverage: {
    universeItems: number;
    highRiskUniverseItems: number;
    highRiskAuditedThisYear: number;
    highRiskCoverageRate: number;
  };
}

// ============================================================
// Audit
// ============================================================
export type AuditCategory = 'department' | 'system' | 'process' | 'asset' | 'project';
export type AuditEntityStatus = 'active' | 'inactive';
export type AuditFrequency =
  | 'monthly'
  | 'quarterly'
  | 'biannual'
  | 'annual'
  | 'biennial'
  | 'ad_hoc';

export interface AuditUniverseEntity {
  id: string;
  name: string;
  description: string | null;
  category: string;
  ownerId: string;
  ownerName: string;
  riskScore: number;
  auditFrequency: string;
  lastAuditedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UniverseLinkedRisk {
  id: string;
  title: string;
  currentScore: number;
  status: string;
  categoryName: string;
}

export interface UniverseEngagementHistory {
  id: string;
  referenceNumber: string;
  title: string;
  auditType: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export interface AuditUniverseDetail extends AuditUniverseEntity {
  linkedRisks?: UniverseLinkedRisk[];
  engagementHistory?: UniverseEngagementHistory[];
}

export interface AuditPlanItem {
  id: string;
  planId: string;
  universeId: string;
  universeName: string;
  auditType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  engagementCreated: boolean;
  engagementId: string | null;
  notes: string | null;
}

export interface AuditPlanApprovalStep {
  id: string;
  level: number;
  approverId: string;
  approverName: string;
  status: string;
  comment: string | null;
  rejectionReason?: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface AuditPlan {
  id: string;
  title: string;
  year: number;
  status: string;
  description: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  itemsCount: number;
  createdAt: string;
  updatedAt: string;
  items?: AuditPlanItem[];
  approvalChain?: AuditPlanApprovalStep[];
}

export interface AuditEngagement {
  id: string;
  referenceNumber: string;
  title: string;
  universeId: string;
  planItemId: string | null;
  auditType: string;
  status: string;
  priority: string;
  leadAuditorId: string;
  auditManagerId: string;
  auditeeId: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  slaDeadline: string;
  isAdhoc: boolean;
  adhocReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  /** Enriched by list/detail queries; may be absent on create responses */
  leadAuditorName?: string;
  auditManagerName?: string;
  auditeeName?: string;
  universeName?: string;
  description?: string | null;
}

export interface AuditEngagementDetail extends AuditEngagement {
  workingPapers?: AuditWorkingPaper[];
  evidence?: AuditEvidence[];
  findings?: AuditFinding[];
  checklists?: AuditChecklistItem[];
  report?: AuditReport | null;
  assignments?: AuditAssignment[];
}

export interface AuditAssignment {
  id: string;
  engagementId: string;
  userId: string;
  userName: string;
  role: string;
  assignedAt: string;
}

export interface AuditWorkingPaper {
  id: string;
  engagementId: string;
  templateId: string | null;
  sourceDocumentId: string | null;
  workingPaperType: string;
  title: string;
  content: string | null;
  version: number;
  versionNumber?: number;
  status: string;
  createdById: string;
  createdByName: string;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  importMetadata?: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkingPaperImportSectionPreview {
  title: string;
  description: string;
  required: boolean;
  content: string;
  confidence: number;
}

export interface WorkingPaperImportPreview {
  documentId: string;
  fileName: string;
  fileType: string;
  templateId: string | null;
  templateName: string | null;
  workingPaperType: string;
  suggestedTitle: string;
  extractedText: string;
  mappedSections: WorkingPaperImportSectionPreview[];
  content: string;
  confidence: number;
  warnings: string[];
}

export interface AuditEvidence {
  id: string;
  engagementId: string;
  workingPaperId: string | null;
  findingId: string | null;
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedById: string;
  uploadedByName: string;
  description: string | null;
  isDisputed: boolean;
  createdAt: string;
}

export interface AuditFinding {
  id: string;
  engagementId: string;
  engagementReference: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  rootCause: string | null;
  riskImplication: string | null;
  recommendation: string | null;
  auditeeId: string;
  auditeeName: string;
  dueDate: string;
  createdById: string;
  createdByName: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditChecklistItem {
  id: string;
  engagementId: string;
  auditType: string;
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
  result: string;
  notes: string | null;
  evidenceId: string | null;
  testedById: string | null;
  testedAt: string | null;
}

export interface AuditReport {
  id: string;
  engagementId: string;
  engagementReference?: string;
  templateId: string | null;
  title: string;
  status: string;
  version: number;
  versionNumber?: number;
  executiveSummary: string | null;
  scope: string | null;
  methodology: string | null;
  rejectionReason: string | null;
  issuedAt: string | null;
  issuedById: string | null;
  issuedByName: string | null;
  approvalChain?: AuditPlanApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditFollowUp {
  id: string;
  findingId: string;
  managementResponse: string | null;
  responseDate: string | null;
  remediationEvidenceId: string | null;
  verificationStatus: string;
  verificationNotes: string | null;
  verifiedById: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Risk
// ============================================================
export interface RiskCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RiskAssessment {
  id: string;
  riskId: string;
  likelihood: number;
  impact: number;
  score: number;
  notes: string | null;
  assessorId: string;
  assessorName: string;
  assessedAt: string;
  createdAt: string;
}

export interface Risk {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  ownerId: string;
  ownerName: string;
  status: string;
  currentLikelihood: number;
  currentImpact: number;
  currentScore: number;
  universeId: string | null;
  universeName: string | null;
  lastAssessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestAssessment?: RiskAssessment | null;
}

// ============================================================
// Workflow
// ============================================================
export interface WorkflowApprovalStep {
  id: string;
  approvalId: string;
  level: number;
  approverId: string;
  approverName: string;
  status: string;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface WorkflowApproval {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  currentLevel: number;
  totalLevels: number;
  rejectionReason: string | null;
  submittedById: string;
  submittedByName: string;
  createdAt: string;
  updatedAt: string;
  steps?: WorkflowApprovalStep[];
}

export interface WorkflowAssignment {
  id: string;
  engagementId: string;
  engagementReference: string;
  engagementTitle: string;
  userId: string;
  userName: string;
  role: string;
  assignedById: string;
  assignedByName: string;
  assignedAt: string;
}

export interface AssignmentCandidateDto {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  skills: string[];
  activeEngagementCount: number;
}

export interface WorkflowEscalation {
  id: string;
  entityType: string;
  entityId: string;
  escalationLevel: number;
  reason: string;
  notifiedUserId: string;
  notifiedUserName: string;
  notifiedAt: string;
  acknowledgedAt: string | null;
}

export interface EscalationPolicy {
  id: string;
  auditType: string;
  level1Hours: number;
  level2Hours: number;
  level3Hours: number;
  level4Hours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Workflow — Ad-hoc Requests
// ============================================================
export type RequestStatus = 'pending' | 'completed' | 'rejected' | 'cancelled';
export type RequestStepStatus = 'pending' | 'approved' | 'signed' | 'rejected';
export type RequestActionType = 'approve' | 'reject' | 'sign' | 'comment';

export interface WorkflowUserBrief {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
}

export interface RequestStep {
  id: string;
  requestId: string;
  level: number;
  recipientId: string;
  status: RequestStepStatus;
  actedAt: string | null;
  createdAt: string;
  recipient?: WorkflowUserBrief;
}

export interface RequestAction {
  id: string;
  requestId: string;
  stepId: string | null;
  actorId: string;
  actionType: RequestActionType;
  comment: string | null;
  signatureHash: string | null;
  createdAt: string;
  actor?: WorkflowUserBrief;
}

export interface RequestAttachment {
  documentId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
}

export interface WorkflowRequest {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  initiatorId: string;
  currentLevel: number;
  status: RequestStatus;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  initiator?: WorkflowUserBrief;
  steps?: RequestStep[];
  actions?: RequestAction[];
  attachments?: RequestAttachment[];
}

export interface RequestCandidate {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
}

export interface SignatureVerification {
  actionId: string;
  signerId: string;
  signedAt: string;
  valid: boolean;
  storedHash: string;
  recomputedHash: string;
}

// ============================================================
// Documents
// ============================================================
export interface DocumentDto {
  id: string;
  fileName: string;
  storedName: string;
  fileType: string;
  fileSize: number;
  entityType: string | null;
  entityId: string | null;
  versionNumber: number;
  uploadedById: string;
  uploadedByName: string;
  description: string | null;
  createdAt: string;
}

export interface DocumentVersionDto {
  id: string;
  documentId: string;
  versionNumber: number;
  fileName: string;
  storedName: string;
  fileSize: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export interface DocumentTemplateDto {
  id: string;
  name: string;
  category: string;
  description: string | null;
  documentId: string | null;
  content: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Settings
// ============================================================
export type SettingsAuditType = 'it' | 'financial' | 'compliance' | 'systems' | 'all';

export interface WorkingPaperTemplateSection {
  title: string;
  description: string;
  placeholder: string;
  required: boolean;
}

export interface WorkingPaperTemplateDto {
  id: string;
  name: string;
  description: string | null;
  auditType: SettingsAuditType;
  sections: WorkingPaperTemplateSection[];
  isActive: boolean;
  isDefault: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ReportTemplateSection {
  key: string;
  title: string;
  description: string;
  includeFindings: boolean;
}

export interface ReportTemplateVariable {
  key: string;
  description: string;
  example: string;
}

export interface ReportTemplateDto {
  id: string;
  name: string;
  description: string | null;
  sections: ReportTemplateSection[];
  headerConfig: unknown | null;
  footerConfig: unknown | null;
  signatureConfig: unknown | null;
  availableVariables: ReportTemplateVariable[];
  isActive: boolean;
  isDefault: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SystemConfigDto {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  isPublic: boolean;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Notifications
// ============================================================
export interface NotificationDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationQueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

export interface NotificationTemplate {
  id: string;
  eventKey: string;
  channel: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Logs
// ============================================================
export interface AuditLogEntry {
  id: string;
  action: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  userDisplayName: string | null;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  durationMs: number | null;
  oldValues: unknown;
  newValues: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface LogSummaryRow {
  module: string;
  totalActions: number;
  successCount: number;
  failureCount: number;
}

// ============================================================
// Background Jobs
// ============================================================
export interface ScheduledJob {
  id: string;
  jobKey: string;
  description: string | null;
  cronExpression: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdAt: string;
}
