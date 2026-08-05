import { z } from 'zod';
import { AuditType, SELECTABLE_AUDIT_TYPES } from '../../../domain/enum/audit.enum';

export const FrameworkCategory = z.enum(['it', 'financial', 'compliance', 'systems', 'governance']);

export const CreateFrameworkRequestSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9.\-]+$/, 'Code may contain letters, numbers, dot and hyphen only'),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  category: FrameworkCategory,
  isActive: z.boolean().optional(),
});

export const UpdateFrameworkRequestSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  category: FrameworkCategory.optional(),
  isActive: z.boolean().optional(),
});

export const CreateControlRequestSchema = z.object({
  frameworkId: z.string().uuid(),
  controlReference: z.string().trim().min(1).max(80),
  controlDescription: z.string().trim().min(1),
  testProcedure: z.string().trim().min(1),
  auditType: z.enum(SELECTABLE_AUDIT_TYPES),
  isActive: z.boolean().optional(),
});

export const UpdateControlRequestSchema = z.object({
  frameworkId: z.string().uuid().optional(),
  controlReference: z.string().trim().min(1).max(80).optional(),
  controlDescription: z.string().trim().min(1).optional(),
  testProcedure: z.string().trim().min(1).optional(),
  auditType: z.enum(SELECTABLE_AUDIT_TYPES).optional(),
  isActive: z.boolean().optional(),
});

export const ControlQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().optional(),
  frameworkId: z.string().uuid().optional(),
  auditType: z.enum(SELECTABLE_AUDIT_TYPES).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const LinkRiskRequestSchema = z.object({
  riskId: z.string().uuid(),
});

export type LinkRiskRequestDto = z.infer<typeof LinkRiskRequestSchema>;
export type CreateFrameworkRequestDto = z.infer<typeof CreateFrameworkRequestSchema>;
export type UpdateFrameworkRequestDto = z.infer<typeof UpdateFrameworkRequestSchema>;
export type CreateControlRequestDto = z.infer<typeof CreateControlRequestSchema>;
export type UpdateControlRequestDto = z.infer<typeof UpdateControlRequestSchema>;
export type ControlQueryDto = z.infer<typeof ControlQuerySchema>;
