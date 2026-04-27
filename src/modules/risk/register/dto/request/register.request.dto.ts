import { z } from 'zod';
import { RiskStatus } from '../../../domain/enum/risk.enum';

const RatingSchema = z.coerce.number().int().min(1).max(5);

export const CreateRiskRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  categoryId: z.string().uuid(),
  ownerId: z.string().uuid(),
  likelihood: RatingSchema,
  impact: RatingSchema,
  status: z.nativeEnum(RiskStatus).default(RiskStatus.Open),
  universeId: z.string().uuid().nullable().optional(),
});

export const UpdateRiskRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  likelihood: RatingSchema.optional(),
  impact: RatingSchema.optional(),
  universeId: z.string().uuid().nullable().optional(),
});

export const UpdateRiskStatusRequestSchema = z.object({
  status: z.nativeEnum(RiskStatus),
});

export const RiskRegisterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(RiskStatus).optional(),
  ownerId: z.string().uuid().optional(),
  sortBy: z.enum(['current_score', 'title', 'created_at', 'updated_at']).default('current_score'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateRiskRequestDto = z.infer<typeof CreateRiskRequestSchema>;
export type UpdateRiskRequestDto = z.infer<typeof UpdateRiskRequestSchema>;
export type UpdateRiskStatusRequestDto = z.infer<typeof UpdateRiskStatusRequestSchema>;
export type RiskRegisterQueryDto = z.infer<typeof RiskRegisterQuerySchema>;
