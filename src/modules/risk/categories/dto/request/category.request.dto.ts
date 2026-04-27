import { z } from 'zod';

export const CreateRiskCategoryRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
});

export const UpdateRiskCategoryRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const RiskCategoryQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
});

export type CreateRiskCategoryRequestDto = z.infer<typeof CreateRiskCategoryRequestSchema>;
export type UpdateRiskCategoryRequestDto = z.infer<typeof UpdateRiskCategoryRequestSchema>;
export type RiskCategoryQueryDto = z.infer<typeof RiskCategoryQuerySchema>;
