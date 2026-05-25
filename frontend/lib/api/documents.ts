import { api } from '../api-client';
import type { DocumentDto, DocumentVersionDto, DocumentTemplateDto } from '../types/domain';
import type { PaginatedResult } from '../types/api';

export interface DocumentsListQuery {
  page?: number;
  pageSize?: number;
  entityType?: string;
  entityId?: string;
  search?: string;
}

const triggerBlobDownload = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

export const documentsApi = {
  list: (query: DocumentsListQuery) =>
    api.getPaginated<DocumentDto>('/documents', {
      page: query.page,
      pageSize: query.pageSize,
      entityType: query.entityType,
      search: query.search,
    }),
  upload: (
    file: File,
    opts?: { module?: string; entityType?: string; entityId?: string; description?: string },
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('module', opts?.module ?? 'document');
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
  // Same-origin streaming URL — works for any storage provider (local, S3,
  // Azure) without requiring bucket CORS, because bytes are proxied through
  // our own origin.
  downloadUrl: (id: string) => `/api/proxy/documents/${id}/file`,
  download: async (id: string, fileName: string): Promise<void> => {
    const res = await fetch(`/api/proxy/documents/${id}/file`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Failed to download file (status ${res.status})`);
    }
    triggerBlobDownload(await res.blob(), fileName);
  },
};

export type DocumentsListResult = PaginatedResult<DocumentDto>;
