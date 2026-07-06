import { z } from 'zod';
import { WorkflowEntityType } from '../../../domain/enum/workflow.enum';

export const CreateApprovalRequestSchema = z.object({
  entityType: z.nativeEnum(WorkflowEntityType),
  entityId: z.string().uuid(),
});

// "Approve with edit": lets the current approver fix a small issue (e.g. a
// typo) themselves at the moment of approval instead of rejecting and forcing
// a full resubmission back through level 1. AuditReport accepts the three
// report body fields; AuditWorkingPaper accepts `content` (the paper's full
// serialized content, as edited in the approve panel).
export const ApprovalEditsSchema = z.object({
  executiveSummary: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
  methodology: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
}).partial();

export const ApprovalActionRequestSchema = z.object({
  comment: z.string().max(5000).optional(),
  edits: ApprovalEditsSchema.optional(),
});

export const RejectApprovalRequestSchema = z.object({
  reason: z.string().min(1).max(5000),
});

export const ApprovalEntityParamsSchema = z.object({
  type: z.nativeEnum(WorkflowEntityType),
  id: z.string().uuid(),
});

export const PendingApprovalQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateApprovalRequestDto = z.infer<typeof CreateApprovalRequestSchema>;
export type ApprovalEditsDto = z.infer<typeof ApprovalEditsSchema>;
export type ApprovalActionRequestDto = z.infer<typeof ApprovalActionRequestSchema>;
export type RejectApprovalRequestDto = z.infer<typeof RejectApprovalRequestSchema>;
export type PendingApprovalQueryDto = z.infer<typeof PendingApprovalQuerySchema>;
