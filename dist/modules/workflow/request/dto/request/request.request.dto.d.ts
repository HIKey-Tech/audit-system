import { z } from 'zod';
export declare const CreateRequestSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    recipientIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    recipientIds: string[];
    description?: string | undefined;
}, {
    title: string;
    recipientIds: string[];
    description?: string | undefined;
}>;
export declare const ApproveRequestSchema: z.ZodObject<{
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    comment?: string | undefined;
}, {
    comment?: string | undefined;
}>;
export declare const RejectRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const SignRequestSchema: z.ZodObject<{
    affirmation: z.ZodString;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    affirmation: string;
    comment?: string | undefined;
}, {
    affirmation: string;
    comment?: string | undefined;
}>;
export declare const CommentRequestSchema: z.ZodObject<{
    comment: z.ZodString;
}, "strip", z.ZodTypeAny, {
    comment: string;
}, {
    comment: string;
}>;
export declare const RequestListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["pending", "completed", "rejected", "cancelled"]>>;
    role: z.ZodOptional<z.ZodEnum<["initiated", "received"]>>;
    sortBy: z.ZodDefault<z.ZodEnum<["created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "updated_at";
    sortOrder: "asc" | "desc";
    status?: "pending" | "rejected" | "cancelled" | "completed" | undefined;
    role?: "received" | "initiated" | undefined;
}, {
    status?: "pending" | "rejected" | "cancelled" | "completed" | undefined;
    role?: "received" | "initiated" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "updated_at" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const RequestInboxQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const RequestIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CreateRequestDto = z.infer<typeof CreateRequestSchema>;
export type ApproveRequestDto = z.infer<typeof ApproveRequestSchema>;
export type RejectRequestDto = z.infer<typeof RejectRequestSchema>;
export type SignRequestDto = z.infer<typeof SignRequestSchema>;
export type CommentRequestDto = z.infer<typeof CommentRequestSchema>;
export type RequestListQueryDto = z.infer<typeof RequestListQuerySchema>;
export type RequestInboxQueryDto = z.infer<typeof RequestInboxQuerySchema>;
//# sourceMappingURL=request.request.dto.d.ts.map