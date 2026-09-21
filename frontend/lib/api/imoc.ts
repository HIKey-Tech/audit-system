import { api } from '@/lib/api-client';

export interface ImocIntegrationStatus {
  enabled: boolean;
  configured: boolean;
  syncEnabled: boolean;
  lastSuccessfulSyncAt: string | null;
  linkedTicketCount: number;
  connectionMessage: string;
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

export const imocApi = {
  status: () => api.get<ImocIntegrationStatus>('/integration/imoc/status'),
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
};
