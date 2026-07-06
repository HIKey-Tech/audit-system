import { z } from 'zod';

export const CreateEvidenceRequestSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  dueDate: z.coerce.date().optional(),
  /** Defaults to the engagement's auditee when omitted. */
  assignedToId: z.string().uuid().optional(),
});
export type CreateEvidenceRequestDto = z.infer<typeof CreateEvidenceRequestSchema>;

export const ReturnEvidenceRequestSchema = z.object({
  reason: z.string().min(3).max(2000),
});
export type ReturnEvidenceRequestDto = z.infer<typeof ReturnEvidenceRequestSchema>;
