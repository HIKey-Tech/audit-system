import { api } from '@/lib/api-client';

export interface ImocIntegrationStatus {
  enabled: boolean;
  configured: boolean;
  syncEnabled: boolean;
  lastSuccessfulSyncAt: string | null;
  linkedTicketCount: number;
  connectionMessage: string;
}

export interface ImocRealStatus {
  reachable: boolean;
  authenticated: boolean;
  lastError: string | null;
  checkedAt: string;
}

export interface ImocProcessingRecord {
  handleOpinion: string | null;
  handleResult: string | null;
  handleTime: string | null;
  handleUser: string | null;
  handleGroupName: string | null;
  stepName: string | null;
}

export interface ImocTicket {
  orderId: string;
  orderNumber: string;
  orderName: string | null;
  modelId: string | null;
  modelName: string | null;
  modelType: string | null;
  orderStatus: string | null;
  slaStatus: string | null;
  currentStepId: string | null;
  currentStepName: string | null;
  currentStepSequence: number | null;
  currentUser: string | null;
  currentHandlingGroup: string | null;
  applicant: string | null;
  beginTime: string | null;
  endTime: string | null;
  processType: string | null;
  sourceTenant: string | null;
  priority: string | null;
  processingHistory: ImocProcessingRecord[];
  retrievedAt: string;
}

export interface ImocTicketPage {
  items: ImocTicket[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ImocTicketLink {
  id: string;
  engagementId: string;
  orderId: string;
  orderNumber: string;
  orderName: string | null;
  modelId: string | null;
  modelName: string | null;
  modelType: string | null;
  lastStatus: string | null;
  lastSlaStatus: string | null;
  lastStepName: string | null;
  lastStepSequence: number | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImocTicketSnapshot {
  id: string;
  ticketLinkId: string;
  auditEvidenceId: string | null;
  status: string | null;
  slaStatus: string | null;
  payloadSha256: string;
  sourceRetrievedAt: string;
  capturedById: string;
  createdAt: string;
}

export interface ImocTicketSearch {
  page?: number;
  pageSize?: number;
  orderStatus?: string;
  modelId?: string;
  modelName?: string;
  orderNumber?: string;
  orderName?: string;
  currentUser?: string;
  slaStatus?: string;
  beginStartDate?: string;
  beginEndDate?: string;
  endStartDate?: string;
  endEndDate?: string;
}

export interface ImocRuleCriteria {
  orderStatus?: Array<'processing' | 'dismissed' | 'reback' | 'completed' | 'suspend' | 'scrapped' | 'draft'>;
  slaStatus?: string[];
  modelIds?: string[];
  modelNames?: string[];
  modelTypes?: string[];
  orderSources?: string[];
  nameContains?: string;
  currentUsers?: string[];
  createdWithinDays?: number;
}

export interface ImocIngestionRule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  criteria: ImocRuleCriteria;
  category: string | null;
  riskCategoryId: string | null;
  lookbackDays: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunFetched: number | null;
  lastRunIngested: number | null;
  lastRunError: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImocIngestionRun {
  id: string;
  trigger: string;
  triggeredById: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  rulesEvaluated: number;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errorSummary: string | null;
  createdAt: string;
}

export interface ImocStoredTicket {
  id: string;
  orderId: string;
  orderNumber: string;
  orderName: string | null;
  modelId: string | null;
  modelName: string | null;
  modelType: string | null;
  orderSource: string | null;
  orderStatus: string | null;
  slaStatus: string | null;
  priority: string | null;
  currentHandler: string | null;
  createdByName: string | null;
  imocCreatedAt: string | null;
  imocEndedAt: string | null;
  category: string | null;
  matchedRuleIds: string[];
  matchedRuleNames?: string[];
  linkedEngagementCount: number;
  linkedRiskCount: number;
  firstIngestedAt: string;
  lastSyncedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredTicketDetail extends ImocStoredTicket {
  linkedEngagements: Array<{
    linkId: string;
    engagementId: string;
    engagementTitle: string;
    engagementCode: string;
    isActive: boolean;
    linkedAt: string;
  }>;
  snapshots: Array<{
    id: string;
    status: string | null;
    slaStatus: string | null;
    payloadSha256: string;
    capturedAt: string;
    capturedById: string;
  }>;
  linkedRisks: Array<{
    id: string;
    riskId: string;
    title: string;
    status: string;
    currentScore: number;
    notes: string | null;
    linkedAt: string;
  }>;
}

export interface ImocStoredSummary {
  total: number;
  slaBreachedCount: number;
  openCount: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  bySlaStatus: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
  topModels: Array<{ modelId: string; modelName: string; count: number }>;
}

export interface ImocSavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  ownerId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImocTicketFilterQuery {
  page?: number;
  pageSize?: number;
  status?: string | string[];
  slaStatus?: string | string[];
  category?: string | string[];
  modelId?: string;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  handler?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const imocApi = {
  status: () => api.get<ImocIntegrationStatus>('/integration/imoc/status'),
  checkStatus: () => api.get<ImocRealStatus>('/integration/imoc/status/check'),

  // Live query & engagement link
  search: (query: ImocTicketSearch) => api.post<ImocTicketPage>('/integration/imoc/tickets/search', query),
  detail: (lookup: { orderId?: string; orderNumber?: string }) =>
    api.post<ImocTicket>('/integration/imoc/tickets/detail', lookup),
  listLinks: (engagementId: string) =>
    api.get<ImocTicketLink[]>(`/integration/imoc/engagements/${engagementId}/tickets`),
  link: (engagementId: string, lookup: { orderId?: string; orderNumber?: string }) =>
    api.post<ImocTicketLink>(`/integration/imoc/engagements/${engagementId}/tickets`, lookup),
  unlink: (linkId: string) => api.delete(`/integration/imoc/tickets/${linkId}`),
  refresh: (linkId: string) => api.post<ImocTicketLink>(`/integration/imoc/tickets/${linkId}/refresh`),
  capture: (linkId: string) => api.post<ImocTicketSnapshot>(`/integration/imoc/tickets/${linkId}/capture`),
  snapshots: (linkId: string) => api.get<ImocTicketSnapshot[]>(`/integration/imoc/tickets/${linkId}/snapshots`),
  sync: (limit = 25) => api.post<{ refreshed: number; failed: number }>('/integration/imoc/sync', { limit }),

  // Ingestion Rules
  listRules: () => api.get<ImocIngestionRule[]>('/integration/imoc/rules'),
  getRule: (id: string) => api.get<ImocIngestionRule>(`/integration/imoc/rules/${id}`),
  createRule: (data: Partial<ImocIngestionRule>) =>
    api.post<ImocIngestionRule>('/integration/imoc/rules', data),
  updateRule: (id: string, data: Partial<ImocIngestionRule>) =>
    api.put<ImocIngestionRule>(`/integration/imoc/rules/${id}`, data),
  toggleRule: (id: string) => api.post<ImocIngestionRule>(`/integration/imoc/rules/${id}/toggle`),
  deleteRule: (id: string) => api.delete(`/integration/imoc/rules/${id}`),
  previewRule: (data: { criteria: ImocRuleCriteria; lookbackDays?: number }) =>
    api.post<{ total: number; sample: ImocTicket[] }>('/integration/imoc/rules/preview', data),

  // Ingestion Runs
  runIngestion: () => api.post<any>('/integration/imoc/ingestion/run'),
  listRuns: (page = 1, pageSize = 20) =>
    api.get<{ items: ImocIngestionRun[]; total: number; page: number; pageSize: number }>(
      '/integration/imoc/ingestion/runs',
      { page, pageSize },
    ),
  getRun: (id: string) => api.get<ImocIngestionRun>(`/integration/imoc/ingestion/runs/${id}`),

  // Local Store
  listStoredTickets: (query: ImocTicketFilterQuery) =>
    api.get<{ items: ImocStoredTicket[]; total: number; page: number; pageSize: number; totalPages: number }>(
      '/integration/imoc/store/tickets',
      query as Record<string, string | number | boolean | undefined | null>,
    ),
  getStoredSummary: (query?: ImocTicketFilterQuery) =>
    api.get<ImocStoredSummary>(
      '/integration/imoc/store/summary',
      query as Record<string, string | number | boolean | undefined | null>,
    ),
  getStoredTicket: (id: string) => api.get<StoredTicketDetail>(`/integration/imoc/store/tickets/${id}`),

  // Saved Views
  listViews: () => api.get<ImocSavedView[]>('/integration/imoc/views'),
  createView: (data: { name: string; filters: Record<string, unknown>; isDefault?: boolean }) =>
    api.post<ImocSavedView>('/integration/imoc/views', data),
  updateView: (id: string, data: Partial<ImocSavedView>) =>
    api.put<ImocSavedView>(`/integration/imoc/views/${id}`, data),
  deleteView: (id: string) => api.delete(`/integration/imoc/views/${id}`),

  // Risk Links
  linkRisk: (data: {
    imocTicketId: string;
    riskId?: string;
    createRisk?: {
      title: string;
      description: string;
      categoryId: string;
      likelihood?: number;
      impact?: number;
      businessObjective?: string;
    };
    notes?: string;
  }) => api.post<any>('/integration/imoc/tickets/risk-link', data),
  unlinkRisk: (ticketId: string, riskId: string) =>
    api.delete(`/integration/imoc/tickets/${ticketId}/risk-link/${riskId}`),
};
