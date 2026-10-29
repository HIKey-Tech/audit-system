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
  templates: z.record(z.string(), z.array(ChecklistTemplateControlSchema)),
});

export const ImportFrameworkChecklistsRequestSchema = z.object({
  frameworkIds: z.array(z.string().uuid()).min(1),
  auditType: z.string().trim().optional(),
});

export const BulkCreateChecklistItemsRequestSchema = z.object({
  controls: z.array(
    z.object({
      controlReference: z.string().trim().min(1).max(200),
      controlDescription: z.string().trim().min(1),
      testProcedure: z.string().trim().min(1),
      auditType: z.string().trim().optional(),
    }),
  ).min(1),
});

export interface ImportDocumentChecklistsDto {
  prefix?: string;
  saveToLibrary?: boolean;
  frameworkName?: string;
  frameworkCode?: string;
  category?: string;
  auditType?: string;
  controls?: Array<{
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
  }>;
}

export type CreateChecklistItemRequestDto = z.infer<typeof CreateChecklistItemRequestSchema>;
export type UpdateChecklistItemRequestDto = z.infer<typeof UpdateChecklistItemRequestSchema>;
export type UpdateChecklistTemplatesRequestDto = z.infer<typeof UpdateChecklistTemplatesRequestSchema>;
export type ImportFrameworkChecklistsRequestDto = z.infer<typeof ImportFrameworkChecklistsRequestSchema>;
export type BulkCreateChecklistItemsRequestDto = z.infer<typeof BulkCreateChecklistItemsRequestSchema>;
