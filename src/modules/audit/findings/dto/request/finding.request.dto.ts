import { z } from 'zod';
import { FindingCategory, FindingSeverity, FindingStatus } from '../../../domain/enum/audit.enum';

export const CreateFindingRequestSchema = z.object({
  workingPaperId: z.string().uuid().optional(),
  checklistId: z.string().uuid().optional(),
  riskId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.nativeEnum(FindingCategory),
  severity: z.nativeEnum(FindingSeverity),
  rootCause: z.string().min(1),
  riskImplication: z.string().min(1),
  recommendation: z.string().min(1),
  auditeeId: z.string().uuid(),
  /** Co-responders who may also answer this finding alongside the primary auditee. */
  additionalAuditeeIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().datetime(),
});

export const UpdateFindingRequestSchema = z.object({
  workingPaperId: z.string().uuid().nullable().optional(),
  checklistId: z.string().uuid().nullable().optional(),
  riskId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  category: z.nativeEnum(FindingCategory).optional(),
  severity: z.nativeEnum(FindingSeverity).optional(),
  rootCause: z.string().min(1).optional(),
  riskImplication: z.string().min(1).optional(),
  recommendation: z.string().min(1).optional(),
  auditeeId: z.string().uuid().optional(),
  /** When provided, replaces the full set of co-responders for this finding. */
  additionalAuditeeIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().datetime().optional(),
});

export const UpdateFindingStatusRequestSchema = z.object({
  status: z.nativeEnum(FindingStatus),
});

export const FindingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  severity: z.nativeEnum(FindingSeverity).optional(),
  status: z.nativeEnum(FindingStatus).optional(),
  category: z.nativeEnum(FindingCategory).optional(),
  controlReference: z.string().trim().optional(),
  auditeeId: z.string().uuid().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'due_date', 'severity', 'status']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateFindingRequestDto = z.infer<typeof CreateFindingRequestSchema>;
export type UpdateFindingRequestDto = z.infer<typeof UpdateFindingRequestSchema>;
export type UpdateFindingStatusRequestDto = z.infer<typeof UpdateFindingStatusRequestSchema>;
export type FindingQueryDto = z.infer<typeof FindingQuerySchema>;
