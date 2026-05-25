import { z } from 'zod';
import { AuditPriority, AuditType, PlanStatus } from '../../../domain/enum/audit.enum';
export declare const CreatePlanRequestSchema: z.ZodObject<{
    title: z.ZodString;
    year: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    title: string;
    year: number;
}, {
    title: string;
    year: number;
}>;
export declare const UpdatePlanRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    year: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    year?: number | undefined;
}, {
    title?: string | undefined;
    year?: number | undefined;
}>;
export declare const AddPlanItemRequestSchema: z.ZodObject<{
    universeId: z.ZodString;
    auditType: z.ZodNativeEnum<typeof AuditType>;
    plannedStartDate: z.ZodString;
    plannedEndDate: z.ZodString;
    priority: z.ZodNativeEnum<typeof AuditPriority>;
}, "strip", z.ZodTypeAny, {
    priority: AuditPriority;
    universeId: string;
    auditType: AuditType;
    plannedStartDate: string;
    plannedEndDate: string;
}, {
    priority: AuditPriority;
    universeId: string;
    auditType: AuditType;
    plannedStartDate: string;
    plannedEndDate: string;
}>;
export declare const RejectPlanRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const PlanQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof PlanStatus>>;
    year: z.ZodOptional<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["year", "created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "updated_at" | "year";
    sortOrder: "asc" | "desc";
    status?: PlanStatus | undefined;
    year?: number | undefined;
}, {
    status?: PlanStatus | undefined;
    year?: number | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "updated_at" | "year" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type CreatePlanRequestDto = z.infer<typeof CreatePlanRequestSchema>;
export type UpdatePlanRequestDto = z.infer<typeof UpdatePlanRequestSchema>;
export type AddPlanItemRequestDto = z.infer<typeof AddPlanItemRequestSchema>;
export type RejectPlanRequestDto = z.infer<typeof RejectPlanRequestSchema>;
export type PlanQueryDto = z.infer<typeof PlanQuerySchema>;
//# sourceMappingURL=planning.request.dto.d.ts.map