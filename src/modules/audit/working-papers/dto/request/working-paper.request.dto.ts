import { z } from 'zod';

export const CreateWorkingPaperRequestSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  templateId: z.string().uuid().optional(),
  sourceDocumentId: z.string().uuid().optional(),
  workingPaperType: z.string().min(1).max(100).optional(),
  importMetadata: z.record(z.unknown()).optional(),
});

export const UpdateWorkingPaperRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
});

export const ImportWorkingPaperMetadataSchema = z.object({
  templateId: z.string().uuid().optional(),
  workingPaperType: z.string().min(1).max(100).optional(),
});

export const RejectWorkingPaperRequestSchema = z.object({
  reason: z.string().min(1).max(5000),
});

export type CreateWorkingPaperRequestDto = z.infer<typeof CreateWorkingPaperRequestSchema>;
export type UpdateWorkingPaperRequestDto = z.infer<typeof UpdateWorkingPaperRequestSchema>;
export type ImportWorkingPaperMetadataDto = z.infer<typeof ImportWorkingPaperMetadataSchema>;
export type RejectWorkingPaperRequestDto = z.infer<typeof RejectWorkingPaperRequestSchema>;

export const ApproveWorkingPaperRequestSchema = z.object({
  // Approve-with-edit: full serialized paper content as fixed by the approver.
  edits: z.object({ content: z.string().min(1) }).optional(),
});

export const AddWorkingPaperCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type ApproveWorkingPaperRequestDto = z.infer<typeof ApproveWorkingPaperRequestSchema>;
export type AddWorkingPaperCommentDto = z.infer<typeof AddWorkingPaperCommentSchema>;
