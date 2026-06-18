import { z } from 'zod';
import { AuditPriority, AuditType, EngagementStatus } from '../../../domain/enum/audit.enum';

/**
 * A single checklist control the engagement creator can customise before the
 * engagement starts. Snapshotted onto the engagement; used to populate its
 * checklist instead of the global per-audit-type template when provided.
 */
export const ChecklistControlSchema = z.object({
  controlReference: z.string().min(1).max(100),
  controlDescription: z.string().min(1).max(2000),
  testProcedure: z.string().min(1).max(4000),
});

const EngagementBaseSchema = z.object({
  title: z.string().min(1).max(200),
  leadAuditorId: z.string().uuid(),
  auditManagerId: z.string().uuid(),
  auditeeId: z.string().uuid(),
  plannedStartDate: z.string().datetime(),
  plannedEndDate: z.string().datetime(),
  slaDeadline: z.string().datetime(),
  checklistControls: z.array(ChecklistControlSchema).max(200).optional(),
});

const EngagementScopeSchema = z.object({
  universeId: z.string().uuid(),
  auditType: z.nativeEnum(AuditType),
  priority: z.nativeEnum(AuditPriority),
});

export const CreateEngagementFromPlanRequestSchema = EngagementBaseSchema.extend({
  planItemId: z.string().uuid(),
}).merge(EngagementScopeSchema.partial());

export const CreateAdhocEngagementRequestSchema = EngagementBaseSchema.merge(EngagementScopeSchema).extend({
  adhocReason: z.string().min(1).max(5000),
});

export const UpdateEngagementRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  leadAuditorId: z.string().uuid().optional(),
  auditManagerId: z.string().uuid().optional(),
  auditeeId: z.string().uuid().optional(),
  plannedStartDate: z.string().datetime().optional(),
  plannedEndDate: z.string().datetime().optional(),
  slaDeadline: z.string().datetime().optional(),
  priority: z.nativeEnum(AuditPriority).optional(),
  adhocReason: z.string().max(5000).nullable().optional(),
});

export const UpdateEngagementStatusRequestSchema = z.object({
  status: z.nativeEnum(EngagementStatus),
});

export const EngagementQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(EngagementStatus).optional(),
  auditType: z.nativeEnum(AuditType).optional(),
  leadAuditorId: z.string().uuid().optional(),
  auditManagerId: z.string().uuid().optional(),
  sortBy: z.enum(['created_at', 'planned_start_date', 'sla_deadline', 'reference_number']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const EligibleUsersQuerySchema = z.object({
  role: z.enum(['lead_auditor', 'audit_manager']),
  auditType: z.nativeEnum(AuditType).optional(),
  priority: z.nativeEnum(AuditPriority).optional(),
});

export type CreateEngagementFromPlanRequestDto = z.infer<typeof CreateEngagementFromPlanRequestSchema>;
export type EligibleUsersQueryDto = z.infer<typeof EligibleUsersQuerySchema>;
export type CreateAdhocEngagementRequestDto = z.infer<typeof CreateAdhocEngagementRequestSchema>;
export type UpdateEngagementRequestDto = z.infer<typeof UpdateEngagementRequestSchema>;
export type UpdateEngagementStatusRequestDto = z.infer<typeof UpdateEngagementStatusRequestSchema>;
export type EngagementQueryDto = z.infer<typeof EngagementQuerySchema>;
