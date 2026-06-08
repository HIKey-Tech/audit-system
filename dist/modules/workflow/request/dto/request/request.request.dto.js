"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestIdParamsSchema = exports.RequestInboxQuerySchema = exports.RequestListQuerySchema = exports.CommentRequestSchema = exports.SignRequestSchema = exports.RejectRequestSchema = exports.ApproveRequestSchema = exports.CreateRequestSchema = void 0;
const zod_1 = require("zod");
// ──────────────────────────────────────────────────────────────
// Create request (ordered recipient chain)
// ──────────────────────────────────────────────────────────────
exports.CreateRequestSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(200),
    description: zod_1.z.string().trim().max(5000).optional(),
    recipientIds: zod_1.z
        .array(zod_1.z.string().uuid())
        .min(1, 'At least one recipient is required')
        .max(20, 'A request can have at most 20 recipients'),
});
// ──────────────────────────────────────────────────────────────
// Recipient actions
// ──────────────────────────────────────────────────────────────
exports.ApproveRequestSchema = zod_1.z.object({
    comment: zod_1.z.string().trim().max(5000).optional(),
});
exports.RejectRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().min(1, 'A rejection reason is required').max(5000),
});
exports.SignRequestSchema = zod_1.z.object({
    affirmation: zod_1.z
        .string()
        .trim()
        .min(1, 'Type your full name to affirm the signature')
        .max(200),
    comment: zod_1.z.string().trim().max(5000).optional(),
});
exports.CommentRequestSchema = zod_1.z.object({
    comment: zod_1.z.string().trim().min(1, 'Comment cannot be empty').max(5000),
});
// ──────────────────────────────────────────────────────────────
// Listing
// ──────────────────────────────────────────────────────────────
exports.RequestListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.enum(['pending', 'completed', 'rejected', 'cancelled']).optional(),
    role: zod_1.z.enum(['initiated', 'received']).optional(),
    sortBy: zod_1.z.enum(['created_at', 'updated_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.RequestInboxQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.RequestIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
//# sourceMappingURL=request.request.dto.js.map