import { api } from '../api-client';
import type { PaginatedResult } from '../types/api';
import { downloadFile } from './download';

// ─────────────────────────────────────────────────────────────
// Types — mirror src/modules/system-audit response DTOs
// ─────────────────────────────────────────────────────────────

export type AnalysisType =
  | 'access_listing'
  | 'change_log'
  | 'backup_log'
  | 'incident_log'
  | 'security_event_log'
  | 'configuration'
  | 'vulnerability_scan'
  | 'data_integrity';

export type AnalysisSource = 'upload' | 'iams' | 'entra_id' | 'imoc';
export type LiveSource = Exclude<AnalysisSource, 'upload'>;
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Disposition = 'open' | 'confirmed' | 'false_positive' | 'explained';
export type AccessDecision = 'pending' | 'appropriate' | 'revoke' | 'modify';
export type ExportFormat = 'csv' | 'xlsx';

export interface UserRef {
  id: string;
  name: string;
}

export interface AnalysisField {
  key: string;
  label: string;
  kind: 'text' | 'date' | 'number' | 'boolean' | 'list';
  required: boolean;
  synonyms: string[];
}

export interface AnalysisRule {
  code: string;
  label: string;
  severity: Severity | 'varies';
}

export interface AnalysisTypeInfo {
  type: AnalysisType;
  label: string;
  description: string;
  controls: string[];
  fields: AnalysisField[];
  rules: AnalysisRule[];
  defaultParameters: Record<string, unknown>;
  liveSources: LiveSource[];
}

export interface ExtractPreview {
  analysisType: AnalysisType;
  fileName: string;
  rowCount: number;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
  suggestedMapping: Record<string, string | null>;
  missingRequired: Array<{ key: string; label: string }>;
}

export type SeverityCounts = Record<Severity, number>;

export interface AnalysisRun {
  id: string;
  reference: string;
  title: string;
  analysisType: AnalysisType;
  analysisLabel: string;
  source: AnalysisSource;
  systemName: string;
  trigger: 'manual' | 'scheduled';
  engagement: { id: string; referenceNumber: string; title: string } | null;
  securityTest: { id: string; reference: string; title: string } | null;
  fileName: string | null;
  contentSha256: string | null;
  recordCount: number;
  exceptionCount: number;
  severityCounts: SeverityCounts;
  openExceptions: number;
  reviewStatus: 'open' | 'completed';
  reviewNote: string | null;
  reviewedBy: UserRef | null;
  reviewedAt: string | null;
  isBaseline: boolean;
  baselineRunId: string | null;
  createdBy: UserRef | null;
  createdAt: string;
  summary: Record<string, unknown>;
}

export interface AnalysisRunDetail extends AnalysisRun {
  parameters: Record<string, unknown>;
  controls: string[];
  dispositionCounts: Record<Disposition, number>;
  ruleCounts: Array<{ ruleCode: string; label: string; count: number }>;
  accessReview: { total: number; pending: number; appropriate: number; revoke: number; modify: number } | null;
  hasExtract: boolean;
}

export interface AnalysisException {
  id: string;
  runId: string;
  ruleCode: string;
  ruleLabel: string;
  severity: Severity;
  title: string;
  recordRef: string | null;
  details: Record<string, unknown>;
  disposition: Disposition;
  dispositionNote: string | null;
  disposedBy: UserRef | null;
  disposedAt: string | null;
  finding: { id: string; title: string; status: string } | null;
  createdAt: string;
}

export interface AccessReviewItem {
  id: string;
  runId: string;
  accountId: string;
  displayName: string | null;
  email: string | null;
  department: string | null;
  accountStatus: string | null;
  isPrivileged: boolean;
  lastLoginAt: string | null;
  entitlements: string[];
  flags: string[];
  decision: AccessDecision;
  decisionNote: string | null;
  decidedBy: UserRef | null;
  decidedAt: string | null;
}

export interface MonitoringCheck {
  key: string;
  label: string;
  description: string;
  analysisType: AnalysisType;
  source: AnalysisSource;
  enabled: boolean;
  connected: boolean;
  connectionNote: string | null;
  lastRun: AnalysisRun | null;
}

export interface EmergingRisk {
  riskId: string;
  title: string;
  categoryName: string | null;
  ownerName: string | null;
  trend: 'new' | 'rising';
  currentScore: number;
  previousScore: number | null;
  change: number;
  status: string;
  lastAssessedAt: string | null;
}

export interface MonitoringDashboard {
  generatedAt: string;
  config: {
    enabled: boolean;
    checks: Record<string, boolean>;
    securityEventLookbackDays: number;
    incidentLookbackDays: number;
    notifyOnSeverity: string;
  };
  checks: MonitoringCheck[];
  openExceptions: SeverityCounts;
  exceptionTrend: Array<{ date: string; criticalHigh: number; mediumLow: number }>;
  latestByType: Record<AnalysisType, AnalysisRun | null>;
  security: {
    windowDays: number;
    loginSucceeded: number;
    loginFailed: number;
    mfaFailed: number;
    accessDenied: number;
    tokenReuseDetected: number;
  } | null;
  systemExceptions: { windowDays: number; total: number; bySource: Record<string, number> } | null;
  emergingRisks: EmergingRisk[];
}

export interface MonitoringRunResult {
  ran: Array<{ check: string; runId: string; reference: string; exceptions: number }>;
  skipped: Array<{ check: string; reason: string }>;
  failed: Array<{ check: string; error: string }>;
}

export type SecurityTestType =
  | 'vulnerability_scan'
  | 'penetration_test'
  | 'web_application_test'
  | 'red_team'
  | 'social_engineering';

export type SecurityTestStatus =
  | 'planned'
  | 'authorised'
  | 'in_progress'
  | 'reporting'
  | 'remediation'
  | 'closed'
  | 'cancelled';

export interface SecurityTest {
  id: string;
  reference: string;
  title: string;
  testType: SecurityTestType;
  status: SecurityTestStatus;
  engagement: { id: string; referenceNumber: string; title: string } | null;
  provider: string;
  providerType: 'internal' | 'external';
  scope: string;
  rulesOfEngagement: string | null;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  coordinator: UserRef | null;
  authorisedBy: UserRef | null;
  authorisedAt: string | null;
  report: { documentId: string; fileName: string; fileSize: number; uploadedAt: string } | null;
  notes: string | null;
  assets: Array<{ id: string; assetTag: string; name: string; assetType: string; criticality: string }>;
  createdBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
  allowedTransitions: SecurityTestStatus[];
  results: {
    scanRuns: number;
    latestScan: SeverityCounts | null;
    openExceptions: number;
    findingsRaised: number;
  };
}

export interface SecurityTestDetail extends SecurityTest {
  scanRuns: Array<{
    id: string;
    reference: string;
    title: string;
    createdAt: string;
    exceptionCount: number;
    summary: Record<string, unknown>;
  }>;
}

export interface SecurityTestInput {
  title: string;
  testType: SecurityTestType;
  engagementId?: string | null;
  provider: string;
  providerType: 'internal' | 'external';
  scope: string;
  rulesOfEngagement?: string | null;
  plannedStart: string;
  plannedEnd: string;
  coordinatorId?: string;
  notes?: string | null;
  assetIds?: string[];
}

export type SystemDocumentType =
  | 'policy'
  | 'procedure'
  | 'standard'
  | 'architecture_diagram'
  | 'network_diagram'
  | 'process_manual'
  | 'bcp'
  | 'drp'
  | 'incident_response_plan'
  | 'contract'
  | 'sla'
  | 'other';

export interface SystemDocument {
  id: string;
  title: string;
  docType: SystemDocumentType;
  description: string | null;
  versionLabel: string | null;
  owner: UserRef | null;
  universe: { id: string; name: string } | null;
  asset: { id: string; assetTag: string; name: string } | null;
  vendor: string | null;
  effectiveDate: string | null;
  reviewDueDate: string | null;
  expiryDate: string | null;
  status: 'active' | 'archived';
  file: {
    documentId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    versionNumber: number;
    contentSha256: string | null;
  };
  reviewState: 'ok' | 'due_soon' | 'overdue' | null;
  contractState: 'ok' | 'expiring' | 'expired' | null;
  createdBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemDocumentSummary {
  total: number;
  byType: Record<string, number>;
  reviewOverdue: number;
  reviewDueSoon: number;
  contractsExpired: number;
  contractsExpiring: number;
}

export interface SecuritySummary {
  windowDays: number;
  from: string;
  to: string;
  totals: {
    loginSucceeded: number;
    loginFailed: number;
    mfaFailed: number;
    accessDenied: number;
    tokenReuseDetected: number;
    passwordResets: number;
    mfaResets: number;
  };
  byDay: Array<{ date: string; loginSucceeded: number; loginFailed: number; accessDenied: number }>;
  topFailedAccounts: Array<{ account: string; count: number; lastAt: string; distinctIps: number }>;
  topDeniedUsers: Array<{ userId: string | null; userName: string | null; count: number; lastPath: string | null }>;
  truncated: boolean;
}

export interface SystemLogEntry {
  id: string;
  level: string;
  message: string;
  source: string | null;
  errorName: string | null;
  path: string | null;
  requestId: string | null;
  stack: string | null;
  context: unknown;
  createdAt: string;
}

type Query = Record<string, string | number | boolean | undefined>;

// ─────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────

export interface RunListQuery {
  page?: number;
  pageSize?: number;
  analysisType?: AnalysisType;
  source?: AnalysisSource;
  trigger?: 'manual' | 'scheduled';
  reviewStatus?: 'open' | 'completed';
  engagementId?: string;
  securityTestId?: string;
  search?: string;
}

export interface UploadRunInput {
  analysisType: AnalysisType;
  systemName: string;
  title?: string;
  engagementId?: string;
  securityTestId?: string;
  dateOrder?: 'dmy' | 'mdy';
  mapping?: Record<string, string | null>;
  parameters?: Record<string, unknown>;
  file: File;
}

export interface LiveRunInput {
  analysisType: AnalysisType;
  source: LiveSource;
  title?: string;
  engagementId?: string;
  days?: number;
  parameters?: Record<string, unknown>;
}

export interface RaiseFindingInput {
  exceptionIds: string[];
  engagementId?: string;
  title: string;
  description?: string;
  category: 'it' | 'financial' | 'compliance' | 'operational';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  rootCause: string;
  riskImplication: string;
  recommendation: string;
  auditeeId: string;
  dueDate: string;
}

export const systemAuditApi = {
  types: () => api.get<AnalysisTypeInfo[]>('/system-audit/analytics/types'),

  preview: (analysisType: AnalysisType, file: File) => {
    const form = new FormData();
    form.append('analysisType', analysisType);
    form.append('file', file);
    return api.upload<ExtractPreview>('/system-audit/analytics/preview', form);
  },

  runUpload: (input: UploadRunInput) => {
    const form = new FormData();
    form.append('analysisType', input.analysisType);
    form.append('systemName', input.systemName);
    if (input.title) form.append('title', input.title);
    if (input.engagementId) form.append('engagementId', input.engagementId);
    if (input.securityTestId) form.append('securityTestId', input.securityTestId);
    if (input.dateOrder) form.append('dateOrder', input.dateOrder);
    if (input.mapping) form.append('mapping', JSON.stringify(input.mapping));
    if (input.parameters) form.append('parameters', JSON.stringify(input.parameters));
    form.append('file', input.file);
    return api.upload<AnalysisRunDetail>('/system-audit/analytics/runs', form);
  },

  runLive: (input: LiveRunInput) => api.post<AnalysisRunDetail>('/system-audit/analytics/runs/live', input),

  listRuns: (q: RunListQuery = {}): Promise<PaginatedResult<AnalysisRun>> =>
    api.getPaginated<AnalysisRun>('/system-audit/analytics/runs', q as Query),

  getRun: (id: string) => api.get<AnalysisRunDetail>(`/system-audit/analytics/runs/${id}`),

  listExceptions: (
    runId: string,
    q: { page?: number; pageSize?: number; severity?: Severity; disposition?: Disposition; ruleCode?: string; search?: string } = {},
  ): Promise<PaginatedResult<AnalysisException>> =>
    api.getPaginated<AnalysisException>(`/system-audit/analytics/runs/${runId}/exceptions`, q as Query),

  disposition: (exceptionIds: string[], disposition: Disposition, note?: string) =>
    api.post<{ updated: number }>('/system-audit/analytics/exceptions/disposition', { exceptionIds, disposition, note }),

  raiseFinding: (runId: string, input: RaiseFindingInput) =>
    api.post<{ findingId: string; linkedExceptions: number }>(`/system-audit/analytics/runs/${runId}/findings`, input),

  markBaseline: (runId: string) => api.post<AnalysisRunDetail>(`/system-audit/analytics/runs/${runId}/baseline`),

  completeReview: (runId: string, note?: string) =>
    api.post<AnalysisRunDetail>(`/system-audit/analytics/runs/${runId}/complete-review`, { note }),

  exportExceptions: (runId: string, format: ExportFormat) =>
    downloadFile(`/system-audit/analytics/runs/${runId}/exceptions/export`, { format }, `exceptions.${format}`),

  downloadExtract: (runId: string) => downloadFile(`/system-audit/analytics/runs/${runId}/extract`, {}, 'extract'),

  // ── Access reviews ─────────────────────────────────────────
  listAccessItems: (
    runId: string,
    q: { page?: number; pageSize?: number; decision?: AccessDecision; flagged?: boolean; privileged?: boolean; search?: string } = {},
  ): Promise<PaginatedResult<AccessReviewItem>> =>
    api.getPaginated<AccessReviewItem>(`/system-audit/access-reviews/${runId}/items`, q as Query),

  decideAccess: (runId: string, itemIds: string[], decision: AccessDecision, note?: string) =>
    api.post<{ updated: number }>(`/system-audit/access-reviews/${runId}/decisions`, { itemIds, decision, note }),

  exportAccessItems: (runId: string, format: ExportFormat) =>
    downloadFile(`/system-audit/access-reviews/${runId}/items/export`, { format }, `access-review.${format}`),

  // ── Continuous monitoring ──────────────────────────────────
  monitoringDashboard: () => api.get<MonitoringDashboard>('/system-audit/monitoring/dashboard'),
  runMonitoringNow: () => api.post<MonitoringRunResult>('/system-audit/monitoring/run'),

  // ── Security tests ─────────────────────────────────────────
  listSecurityTests: (
    q: { page?: number; pageSize?: number; status?: SecurityTestStatus; testType?: SecurityTestType; engagementId?: string; search?: string } = {},
  ): Promise<PaginatedResult<SecurityTest>> => api.getPaginated<SecurityTest>('/system-audit/security-tests', q as Query),
  getSecurityTest: (id: string) => api.get<SecurityTestDetail>(`/system-audit/security-tests/${id}`),
  createSecurityTest: (input: SecurityTestInput) => api.post<SecurityTestDetail>('/system-audit/security-tests', input),
  updateSecurityTest: (id: string, input: Partial<SecurityTestInput>) =>
    api.put<SecurityTestDetail>(`/system-audit/security-tests/${id}`, input),
  deleteSecurityTest: (id: string) => api.delete(`/system-audit/security-tests/${id}`),
  authoriseSecurityTest: (id: string, note?: string) =>
    api.post<SecurityTestDetail>(`/system-audit/security-tests/${id}/authorise`, { note }),
  changeSecurityTestStatus: (id: string, status: SecurityTestStatus, note?: string) =>
    api.patch<SecurityTestDetail>(`/system-audit/security-tests/${id}/status`, { status, note }),
  addSecurityTestAssets: (id: string, assetIds: string[]) =>
    api.post<SecurityTestDetail>(`/system-audit/security-tests/${id}/assets`, { assetIds }),
  removeSecurityTestAsset: (id: string, assetId: string) =>
    api.delete<SecurityTestDetail>(`/system-audit/security-tests/${id}/assets/${assetId}`),
  uploadSecurityTestReport: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<SecurityTestDetail>(`/system-audit/security-tests/${id}/report`, form);
  },
  downloadSecurityTestReport: (id: string) => downloadFile(`/system-audit/security-tests/${id}/report`, {}, 'report'),

  // ── System documentation ───────────────────────────────────
  listDocuments: (
    q: {
      page?: number;
      pageSize?: number;
      docType?: SystemDocumentType;
      status?: 'active' | 'archived';
      universeId?: string;
      assetId?: string;
      engagementId?: string;
      reviewState?: 'overdue' | 'due_soon';
      contractState?: 'expired' | 'expiring';
      search?: string;
    } = {},
  ): Promise<PaginatedResult<SystemDocument>> => api.getPaginated<SystemDocument>('/system-audit/documentation', q as Query),
  documentSummary: () => api.get<SystemDocumentSummary>('/system-audit/documentation/summary'),
  createDocument: (fields: Record<string, string | undefined>, file: File) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
    form.append('file', file);
    return api.upload<SystemDocument>('/system-audit/documentation', form);
  },
  updateDocument: (id: string, input: Record<string, unknown>) => api.put<SystemDocument>(`/system-audit/documentation/${id}`, input),
  uploadDocumentVersion: (id: string, file: File, fields: { versionLabel?: string; changeNote?: string; reviewDueDate?: string }) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
    form.append('file', file);
    return api.upload<SystemDocument>(`/system-audit/documentation/${id}/versions`, form);
  },
  deleteDocument: (id: string) => api.delete(`/system-audit/documentation/${id}`),
  downloadDocument: (id: string) => downloadFile(`/system-audit/documentation/${id}/download`, {}, 'document'),

  // ── Event monitoring (logging module) ──────────────────────
  securitySummary: (days: number) => api.get<SecuritySummary>('/logs/security/summary', { days }),
  listSystemLogs: (
    q: { page?: number; pageSize?: number; source?: string; search?: string; dateFrom?: string; dateTo?: string } = {},
  ): Promise<PaginatedResult<SystemLogEntry>> => api.getPaginated<SystemLogEntry>('/logs/system', q as Query),
  getSystemLog: (id: string) => api.get<SystemLogEntry>(`/logs/system/${id}`),
};
