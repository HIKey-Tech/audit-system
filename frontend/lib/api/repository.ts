import { api } from '../api-client';
import type { PaginatedResult } from '../types/api';

export type RepositoryCategory = 'audit_record' | 'supporting_document' | 'evidence' | 'other';

/** Dropdown filter value sent to the API (`all` = no category filter). */
export type RepositoryCategoryFilter = 'all' | 'audit_record' | 'supporting_document' | 'evidence';

export interface RepositoryEngagementRef {
  id: string;
  referenceNumber: string;
  title: string;
}

export interface RepositoryItem {
  id: string; // document id
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: RepositoryCategory;
  entityType: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; name: string } | null;
  engagement: RepositoryEngagementRef | null;
}

export interface RepositoryListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: RepositoryCategoryFilter;
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

export const repositoryApi = {
  list: (query: RepositoryListQuery): Promise<PaginatedResult<RepositoryItem>> =>
    api.getPaginated<RepositoryItem>('/audit/repository', {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      // omit category when "all" so the API returns everything
      category: query.category && query.category !== 'all' ? query.category : undefined,
    }),

  // Streams bytes through our own origin (works for local or S3 storage),
  // mirroring the documents download pattern.
  download: async (id: string, fileName: string): Promise<void> => {
    const res = await fetch(`/api/proxy/audit/repository/${id}/download`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Failed to download file (status ${res.status})`);
    }
    triggerBlobDownload(await res.blob(), fileName);
  },
};
