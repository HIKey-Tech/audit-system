import { api } from '../api-client';
import type { AuditLogEntry, LogSummaryRow } from '../types/domain';

export interface LogsListQuery {
  page?: number;
  pageSize?: number;
  module?: string;
  status?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const logsApi = {
  list: (q?: LogsListQuery) =>
    api.getPaginated<AuditLogEntry>('/logs', q as Record<string, string | number | boolean | undefined>),
  get: (id: string) => api.get<AuditLogEntry>(`/logs/${id}`),
  modules: () => api.get<string[]>('/logs/modules'),
  summary: (q?: { dateFrom?: string; dateTo?: string }) =>
    api.get<LogSummaryRow[]>('/logs/summary', q as Record<string, string | undefined>),
};
