import { z } from 'zod';

export const GenerateReportRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  executiveSummary: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
  methodology: z.string().min(1).optional(),
  templateId: z.string().uuid().optional(),
});

export const UpdateReportRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  executiveSummary: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
  methodology: z.string().min(1).optional(),
  templateId: z.string().uuid().optional(),
});

export const RejectReportRequestSchema = z.object({
  reason: z.string().min(1).max(5000),
});

export const ExportReportQuerySchema = z.object({
  format: z.enum(['docx', 'pdf']).optional(),
});

export const ReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'issued_at', 'status', 'title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type GenerateReportRequestDto = z.infer<typeof GenerateReportRequestSchema>;
export type UpdateReportRequestDto = z.infer<typeof UpdateReportRequestSchema>;
export type RejectReportRequestDto = z.infer<typeof RejectReportRequestSchema>;
export type ExportReportQueryDto = z.infer<typeof ExportReportQuerySchema>;
export type ReportQueryDto = z.infer<typeof ReportQuerySchema>;
