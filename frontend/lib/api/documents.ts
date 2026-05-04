import { api } from '../api-client';
import type { DocumentDto, DocumentVersionDto, DocumentTemplateDto } from '../types/domain';

export interface DocumentsListQuery {
  page?: number;
  pageSize?: number;
  entityType?: string;
  entityId?: string;
  search?: string;
}

export const documentsApi = {
  upload: (file: File, opts?: { entityType?: string; entityId?: string; description?: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts?.entityType) fd.append('entityType', opts.entityType);
    if (opts?.entityId) fd.append('entityId', opts.entityId);
    if (opts?.description) fd.append('description', opts.description);
    return api.upload<DocumentDto>('/documents', fd);
  },
  get: (id: string) => api.get<DocumentDto>(`/documents/${id}`),
  remove: (id: string) => api.delete(`/documents/${id}`),
  listByEntity: (entityType: string, entityId: string) =>
    api.get<DocumentDto[]>(`/documents/by-entity/${entityType}/${entityId}`),
  uploadVersion: (documentId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload<DocumentVersionDto>(`/documents/${documentId}/versions`, fd);
  },
  listVersions: (documentId: string) =>
    api.get<DocumentVersionDto[]>(`/documents/${documentId}/versions`),
  // templates
  listTemplates: () => api.get<DocumentTemplateDto[]>('/documents/templates'),
  getTemplate: (id: string) => api.get<DocumentTemplateDto>(`/documents/templates/${id}`),
  createTemplate: (dto: { name: string; category: string; description?: string; content?: string; documentId?: string }) =>
    api.post<DocumentTemplateDto>('/documents/templates', dto),
  updateTemplate: (id: string, dto: { name?: string; description?: string; content?: string; isActive?: boolean }) =>
    api.patch<DocumentTemplateDto>(`/documents/templates/${id}`, dto),
  deleteTemplate: (id: string) => api.delete(`/documents/templates/${id}`),
  downloadUrl: (id: string) => `/api/proxy/documents/${id}/download`,
};
