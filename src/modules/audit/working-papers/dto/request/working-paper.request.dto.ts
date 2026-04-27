import { z } from 'zod';

export const CreateWorkingPaperRequestSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

export const UpdateWorkingPaperRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
});

export const RejectWorkingPaperRequestSchema = z.object({
  reason: z.string().min(1).max(5000),
});

export type CreateWorkingPaperRequestDto = z.infer<typeof CreateWorkingPaperRequestSchema>;
export type UpdateWorkingPaperRequestDto = z.infer<typeof UpdateWorkingPaperRequestSchema>;
export type RejectWorkingPaperRequestDto = z.infer<typeof RejectWorkingPaperRequestSchema>;
