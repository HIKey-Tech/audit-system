import { z } from 'zod';

export const HighRiskQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  threshold: z.coerce.number().int().min(1).max(25).default(13),
});

export type HighRiskQueryDto = z.infer<typeof HighRiskQuerySchema>;
