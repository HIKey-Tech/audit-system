import { api } from '@/lib/api-client';

export interface ProjectPlusStatus {
  enabled: boolean;
  configured: boolean;
}

export interface ProjectPlusRealStatus {
  reachable: boolean;
  authenticated: boolean;
  lastError: string | null;
  checkedAt: string;
}

export interface ProjectPlusEntity {
  referenceCode: string | null;
  pin: string | null;
  fullName: string;
  entityType: string | null;
  entitySubType: string | null;
  rcNumber: string | null;
  tin: string | null;
  website: string | null;
  contactPersonFullName: string | null;
  status: string | null;
  recordDate: string | null;
  createdBy: string | null;
  finClientId: string | null;
  finVendorId: string | null;
  finCustomerId: string | null;
}

export interface ProjectPlusDocumentType {
  code: string;
  description: string;
}

export interface ProjectPlusEntityLink {
  id: string;
  engagementId: string;
  customerType: string;
  referenceCode: string;
  fullName: string;
  entityType: string | null;
  entitySubType: string | null;
  rcNumber: string | null;
  tin: string | null;
  lastStatus: string | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPlusEntityQuery {
  customerType: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export const projectPlusApi = {
  status: () => api.get<ProjectPlusStatus>('/integration/projectplus/status'),
  checkStatus: () => api.get<ProjectPlusRealStatus>('/integration/projectplus/status/check'),
  listEntities: (query: ProjectPlusEntityQuery) =>
    api.getPaginated<ProjectPlusEntity>('/integration/projectplus/entities', { ...query }),
  documentTypes: () => api.get<ProjectPlusDocumentType[]>('/integration/projectplus/document-types'),
  listLinks: (engagementId: string) =>
    api.get<ProjectPlusEntityLink[]>(`/integration/projectplus/engagements/${engagementId}/entities`),
  link: (engagementId: string, body: { customerType: string; referenceCode: string }) =>
    api.post<ProjectPlusEntityLink>(`/integration/projectplus/engagements/${engagementId}/entities`, body),
  unlink: (linkId: string) => api.delete(`/integration/projectplus/entity-links/${linkId}`),
};
