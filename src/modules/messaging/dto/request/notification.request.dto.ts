// src/modules/messaging/dto/request/notification.request.dto.ts
import { z } from 'zod';

export const NotificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  isRead: z.coerce.boolean().optional(),
  sortBy: z.enum(['created_at', 'read_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type NotificationQueryDto = z.infer<typeof NotificationQuerySchema>;
