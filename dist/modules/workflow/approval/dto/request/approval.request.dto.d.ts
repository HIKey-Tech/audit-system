import { z } from 'zod';
import { WorkflowEntityType } from '../../../domain/enum/workflow.enum';
export declare const CreateApprovalRequestSchema: z.ZodObject<{
    entityType: z.ZodNativeEnum<typeof WorkflowEntityType>;
    entityId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    entityType: WorkflowEntityType;
    entityId: string;
}, {
    entityType: WorkflowEntityType;
    entityId: string;
}>;
export declare const ApprovalActionRequestSchema: z.ZodObject<{
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    comment?: string | undefined;
}, {
    comment?: string | undefined;
}>;
export declare const RejectApprovalRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const ApprovalEntityParamsSchema: z.ZodObject<{
    type: z.ZodNativeEnum<typeof WorkflowEntityType>;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: WorkflowEntityType;
}, {
    id: string;
    type: WorkflowEntityType;
}>;
export declare const PendingApprovalQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type CreateApprovalRequestDto = z.infer<typeof CreateApprovalRequestSchema>;
export type ApprovalActionRequestDto = z.infer<typeof ApprovalActionRequestSchema>;
export type RejectApprovalRequestDto = z.infer<typeof RejectApprovalRequestSchema>;
export type PendingApprovalQueryDto = z.infer<typeof PendingApprovalQuerySchema>;
//# sourceMappingURL=approval.request.dto.d.ts.map