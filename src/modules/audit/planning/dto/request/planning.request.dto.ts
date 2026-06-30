import { z } from 'zod';
import { AuditPriority, AuditType, PlanStatus } from '../../../domain/enum/audit.enum';

export const CreatePlanRequestSchema = z.object({
  title: z.string().min(1).max(200),
  year: z.coerce.number().int().min(2000).max(2100),
  description: z.string().max(2000).optional(),
});

export const UpdatePlanRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  description: z.string().max(2000).optional(),
});

export const AddPlanItemRequestSchema = z.object({
  universeId: z.string().uuid(),
  auditType: z.nativeEnum(AuditType),
  plannedStartDate: z.string().datetime(),
  plannedEndDate: z.string().datetime(),
  priority: z.nativeEnum(AuditPriority),
  notes: z.string().max(5000).nullable().optional(),
});

export const RejectPlanRequestSchema = z.object({
  reason: z.string().min(1).max(5000),
});

export const PlanQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(PlanStatus).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  sortBy: z.enum(['year', 'created_at', 'updated_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreatePlanRequestDto = z.infer<typeof CreatePlanRequestSchema>;
export type UpdatePlanRequestDto = z.infer<typeof UpdatePlanRequestSchema>;
export type AddPlanItemRequestDto = z.infer<typeof AddPlanItemRequestSchema>;
export type RejectPlanRequestDto = z.infer<typeof RejectPlanRequestSchema>;
export type PlanQueryDto = z.infer<typeof PlanQuerySchema>;
