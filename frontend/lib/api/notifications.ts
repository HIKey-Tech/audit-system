import { api } from '../api-client';
import type {
  NotificationDto,
  NotificationQueueStats,
  NotificationTemplate,
} from '../types/domain';
import type { PaginatedResult } from '../types/api';

export interface NotificationsListQuery {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const notificationsApi = {
  list: (q?: NotificationsListQuery): Promise<PaginatedResult<NotificationDto>> =>
    api.getPaginated<NotificationDto>(
      '/notifications',
      q as Record<string, string | number | boolean | undefined>,
    ),
  unreadCount: () => api.get<{ unread: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.post<NotificationDto>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ updated: number }>('/notifications/read-all'),
  queueStats: () => api.get<NotificationQueueStats>('/notifications/queue/stats'),
  // templates
  listTemplates: () => api.get<NotificationTemplate[]>('/notifications/templates'),
  getTemplate: (id: string) => api.get<NotificationTemplate>(`/notifications/templates/${id}`),
};
