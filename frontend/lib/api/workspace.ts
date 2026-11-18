import { api } from '@/lib/api-client';

export interface WorkspaceDocumentSummary {
  id: string;
  title: string;
  template: 'blank' | 'gbb' | string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDocument extends WorkspaceDocumentSummary {
  /** The editor's HTML. */
  content: string;
}

export interface ImportedWordDocument {
  title: string;
  html: string;
  warnings: string[];
}

export const workspaceApi = {
  list: (search?: string) =>
    api.get<WorkspaceDocumentSummary[]>('/workspace/documents', search ? { search } : undefined),
  get: (id: string) => api.get<WorkspaceDocument>(`/workspace/documents/${id}`),
  create: (dto: { title: string; template: 'blank' | 'gbb'; content?: string }) =>
    api.post<WorkspaceDocument>('/workspace/documents', dto),
  update: (id: string, dto: { title?: string; content?: string }) =>
    api.put<WorkspaceDocument>(`/workspace/documents/${id}`, dto),
  remove: (id: string) => api.delete<null>(`/workspace/documents/${id}`),
  /** Converts a Word (.docx) file to editor HTML. Nothing is stored. */
  importWord: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload<ImportedWordDocument>('/workspace/documents/import', fd);
  },
};
