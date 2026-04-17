// src/shared/types/api-response.type.ts
export interface ApiResponse<T = void> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  meta?: PaginationMeta;
  timestamp: string;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export const buildResponse = <T>(
  data: T,
  message = 'Success',
  meta?: PaginationMeta,
): ApiResponse<T> => ({
  success: true,
  message,
  data,
  meta,
  timestamp: new Date().toISOString(),
});

export const buildPaginationMeta = (
  total: number,
  page: number,
  pageSize: number,
): PaginationMeta => ({
  page,
  pageSize,
  total,
  totalPages: Math.ceil(total / pageSize),
  hasNext: page * pageSize < total,
  hasPrev: page > 1,
});

export const parsePagination = (
  query: PaginationQuery,
): { skip: number; take: number; page: number; pageSize: number } => {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
};