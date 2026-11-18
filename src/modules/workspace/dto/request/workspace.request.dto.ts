import { z } from 'zod';

export const CreateWorkspaceDocumentRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** Where the document starts: GBB's controlled-document template, or a blank page. */
  template: z.enum(['blank', 'gbb']).default('blank'),
  /** Optional starting content (for example text imported from a Word file). Ignored for the GBB template. */
  content: z.string().optional(),
});

export const UpdateWorkspaceDocumentRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
});

export const WorkspaceDocumentQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

export type CreateWorkspaceDocumentRequestDto = z.infer<typeof CreateWorkspaceDocumentRequestSchema>;
export type UpdateWorkspaceDocumentRequestDto = z.infer<typeof UpdateWorkspaceDocumentRequestSchema>;
export type WorkspaceDocumentQueryDto = z.infer<typeof WorkspaceDocumentQuerySchema>;
