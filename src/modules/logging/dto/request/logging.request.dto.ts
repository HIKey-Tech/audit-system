import { z } from 'zod';
import { ExportFormatSchema } from '../../../../shared/utils/tabular-export.util';

// Query strings arrive as text; z.coerce.boolean() would read "false" as true.
const QueryBooleanSchema = z.enum(['true', 'false']).transform((v) => v === 'true');

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
  /** Only entries that recorded a data change (old/new values) — the change history view. */
  hasChanges: QueryBooleanSchema.optional(),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const AuditLogExportQuerySchema = AuditLogListQuerySchema.omit({ page: true, pageSize: true }).extend({
  format: ExportFormatSchema,
});

export const SecuritySummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export const SystemLogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  source: z.enum(['http', 'job', 'app']).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
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
export type AuditLogExportQueryDto = z.infer<typeof AuditLogExportQuerySchema>;
export type SecuritySummaryQueryDto = z.infer<typeof SecuritySummaryQuerySchema>;
export type SystemLogListQueryDto = z.infer<typeof SystemLogListQuerySchema>;
