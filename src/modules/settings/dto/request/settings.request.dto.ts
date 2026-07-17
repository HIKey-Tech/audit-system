import { z } from 'zod';
import { SETTINGS_AUDIT_TYPES } from '../../domain/enum/settings.enum';

const WorkingPaperSectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  placeholder: z.string().min(1).max(2000),
  required: z.boolean(),
});

const ReportSectionSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  includeFindings: z.boolean(),
});

const ReportVariableSchema = z.object({
  key: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  example: z.string().min(1).max(500),
});

const ConfigObjectSchema = z.record(z.unknown());

export const CreateWorkingPaperTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  auditType: z.enum(SETTINGS_AUDIT_TYPES),
  sections: z.array(WorkingPaperSectionSchema).min(1),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const UpdateWorkingPaperTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  auditType: z.enum(SETTINGS_AUDIT_TYPES).optional(),
  sections: z.array(WorkingPaperSectionSchema).min(1).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const WorkingPaperTemplateQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  auditType: z.enum(SETTINGS_AUDIT_TYPES).optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'audit_type', 'created_at', 'updated_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateReportTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sections: z.array(ReportSectionSchema).min(1),
  headerConfig: ConfigObjectSchema.nullable().optional(),
  footerConfig: ConfigObjectSchema.nullable().optional(),
  signatureConfig: ConfigObjectSchema.nullable().optional(),
  // A template may legitimately declare no dynamic variables; don't force one.
  availableVariables: z.array(ReportVariableSchema),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const UpdateReportTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  sections: z.array(ReportSectionSchema).min(1).optional(),
  headerConfig: ConfigObjectSchema.nullable().optional(),
  footerConfig: ConfigObjectSchema.nullable().optional(),
  signatureConfig: ConfigObjectSchema.nullable().optional(),
  availableVariables: z.array(ReportVariableSchema).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const ReportTemplateQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'created_at', 'updated_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const UpdateSystemConfigRequestSchema = z.object({
  value: z.string().nullable(),
});

export const BulkUpdateSystemConfigRequestSchema = z.object({
  configs: z.array(
    z.object({
      key: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
      value: z.string().nullable(),
    }),
  ).min(1),
});

export type CreateWorkingPaperTemplateRequestDto = z.infer<typeof CreateWorkingPaperTemplateRequestSchema>;
export type UpdateWorkingPaperTemplateRequestDto = z.infer<typeof UpdateWorkingPaperTemplateRequestSchema>;
export type WorkingPaperTemplateQueryDto = z.infer<typeof WorkingPaperTemplateQuerySchema>;
export type CreateReportTemplateRequestDto = z.infer<typeof CreateReportTemplateRequestSchema>;
export type UpdateReportTemplateRequestDto = z.infer<typeof UpdateReportTemplateRequestSchema>;
export type ReportTemplateQueryDto = z.infer<typeof ReportTemplateQuerySchema>;
export type UpdateSystemConfigRequestDto = z.infer<typeof UpdateSystemConfigRequestSchema>;
export type BulkUpdateSystemConfigRequestDto = z.infer<typeof BulkUpdateSystemConfigRequestSchema>;
