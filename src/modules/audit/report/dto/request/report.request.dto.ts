import { z } from 'zod';

export const UpdateReportRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  executiveSummary: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
  methodology: z.string().min(1).optional(),
});

export const RejectReportRequestSchema = z.object({
  reason: z.string().min(1).max(5000),
});

export const ExportReportQuerySchema = z.object({
  format: z.enum(['docx', 'pdf']).optional(),
});

export type UpdateReportRequestDto = z.infer<typeof UpdateReportRequestSchema>;
export type RejectReportRequestDto = z.infer<typeof RejectReportRequestSchema>;
export type ExportReportQueryDto = z.infer<typeof ExportReportQuerySchema>;
