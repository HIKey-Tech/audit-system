import { z } from 'zod';

const RatingSchema = z.coerce.number().int().min(1).max(5);

export const CreateRiskAssessmentRequestSchema = z.object({
  likelihood: RatingSchema,
  impact: RatingSchema,
  notes: z.string().max(5000).nullable().optional(),
  assessedAt: z.string().datetime().optional(),
});

export const RiskAssessmentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateRiskAssessmentRequestDto = z.infer<typeof CreateRiskAssessmentRequestSchema>;
export type RiskAssessmentQueryDto = z.infer<typeof RiskAssessmentQuerySchema>;
