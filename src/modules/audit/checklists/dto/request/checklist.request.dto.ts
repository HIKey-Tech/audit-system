import { z } from 'zod';
import { AuditType, ChecklistResult, SELECTABLE_AUDIT_TYPES } from '../../../domain/enum/audit.enum';

export const CreateChecklistItemRequestSchema = z.object({
  // Optional — defaults to the engagement's own audit type when omitted.
  auditType: z.enum(SELECTABLE_AUDIT_TYPES).optional(),
  controlReference: z.string().min(1).max(200),
  controlDescription: z.string().min(1),
  testProcedure: z.string().min(1),
});

export const UpdateChecklistItemRequestSchema = z.object({
  result: z.nativeEnum(ChecklistResult),
  notes: z.string().max(5000).nullable().optional(),
});

const ChecklistTemplateControlSchema = z.object({
  controlReference: z.string().min(1).max(200),
  controlDescription: z.string().min(1),
  testProcedure: z.string().min(1),
});

export const UpdateChecklistTemplatesRequestSchema = z.object({
  templates: z.record(z.nativeEnum(AuditType), z.array(ChecklistTemplateControlSchema)),
});

export type CreateChecklistItemRequestDto = z.infer<typeof CreateChecklistItemRequestSchema>;
export type UpdateChecklistItemRequestDto = z.infer<typeof UpdateChecklistItemRequestSchema>;
export type UpdateChecklistTemplatesRequestDto = z.infer<typeof UpdateChecklistTemplatesRequestSchema>;
