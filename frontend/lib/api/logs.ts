import { api } from '../api-client';
import type { AuditLogEntry, LogSummaryRow } from '../types/domain';
import { downloadFile } from './download';

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
  /** Only entries that recorded a data change (the change-history view). */
  hasChanges?: boolean;
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
  /** Download the filtered audit trail (requires log:export). */
  export: (q: Omit<LogsListQuery, 'page' | 'pageSize'>, format: 'csv' | 'xlsx') =>
    downloadFile('/logs/export', { ...(q as Record<string, string | boolean | undefined>), format }, `audit-logs.${format}`),
};
