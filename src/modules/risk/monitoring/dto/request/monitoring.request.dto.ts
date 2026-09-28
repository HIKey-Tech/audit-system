import { z } from 'zod';

export const HighRiskQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  threshold: z.coerce.number().int().min(1).max(25).default(13),
});

export const EmergingRiskQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(90),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type HighRiskQueryDto = z.infer<typeof HighRiskQuerySchema>;
export type EmergingRiskQueryDto = z.infer<typeof EmergingRiskQuerySchema>;
