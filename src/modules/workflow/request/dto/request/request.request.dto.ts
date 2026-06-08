import { z } from 'zod';

// ──────────────────────────────────────────────────────────────
// Create request (ordered recipient chain)
// ──────────────────────────────────────────────────────────────
export const CreateRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  recipientIds: z
    .array(z.string().uuid())
    .min(1, 'At least one recipient is required')
    .max(20, 'A request can have at most 20 recipients'),
});

// ──────────────────────────────────────────────────────────────
// Recipient actions
// ──────────────────────────────────────────────────────────────
export const ApproveRequestSchema = z.object({
  comment: z.string().trim().max(5000).optional(),
});

export const RejectRequestSchema = z.object({
  reason: z.string().trim().min(1, 'A rejection reason is required').max(5000),
});

export const SignRequestSchema = z.object({
  affirmation: z
    .string()
    .trim()
    .min(1, 'Type your full name to affirm the signature')
    .max(200),
  comment: z.string().trim().max(5000).optional(),
});

export const CommentRequestSchema = z.object({
  comment: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
});

// ──────────────────────────────────────────────────────────────
// Listing
// ──────────────────────────────────────────────────────────────
export const RequestListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'completed', 'rejected', 'cancelled']).optional(),
  role: z.enum(['initiated', 'received']).optional(),
  sortBy: z.enum(['created_at', 'updated_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const RequestInboxQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const RequestIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateRequestDto = z.infer<typeof CreateRequestSchema>;
export type ApproveRequestDto = z.infer<typeof ApproveRequestSchema>;
export type RejectRequestDto = z.infer<typeof RejectRequestSchema>;
export type SignRequestDto = z.infer<typeof SignRequestSchema>;
export type CommentRequestDto = z.infer<typeof CommentRequestSchema>;
export type RequestListQueryDto = z.infer<typeof RequestListQuerySchema>;
export type RequestInboxQueryDto = z.infer<typeof RequestInboxQuerySchema>;
