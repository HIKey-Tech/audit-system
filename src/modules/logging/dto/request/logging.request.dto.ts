import { z } from 'zod';

export const AuditLogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  userId: z.string().uuid().optional(),
  module: z.string().min(1).max(100).optional(),
  entityType: z.string().min(1).max(100).optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().min(1).max(255).optional(),
  status: z.enum(['success', 'failure']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const AuditLogIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const AuditLogSummaryQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type AuditLogListQueryDto = z.infer<typeof AuditLogListQuerySchema>;
export type AuditLogIdParamsDto = z.infer<typeof AuditLogIdParamsSchema>;
export type AuditLogSummaryQueryDto = z.infer<typeof AuditLogSummaryQuerySchema>;
