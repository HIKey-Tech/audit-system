// src/modules/background/dto/request/job.request.dto.ts
import { z } from 'zod';

export const JobIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type JobIdParamsDto = z.infer<typeof JobIdParamsSchema>;

export const JobRunHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['running', 'success', 'failure']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type JobRunHistoryQueryDto = z.infer<typeof JobRunHistoryQuerySchema>;
