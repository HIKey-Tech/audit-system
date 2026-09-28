import { z } from 'zod';
import { AuditPriority, AuditType, PlanStatus } from '../../../domain/enum/audit.enum';
export declare const CreatePlanRequestSchema: z.ZodObject<{
    title: z.ZodString;
    year: z.ZodNumber;
    auditType: z.ZodEnum<[AuditType.It, AuditType.Financial, AuditType.Compliance]>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    year: number;
    auditType: AuditType.It | AuditType.Financial | AuditType.Compliance;
    description?: string | undefined;
}, {
    title: string;
    year: number;
    auditType: AuditType.It | AuditType.Financial | AuditType.Compliance;
    description?: string | undefined;
}>;
export declare const UpdatePlanRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    year: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | undefined;
    year?: number | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    year?: number | undefined;
}>;
export declare const AddPlanItemRequestSchema: z.ZodObject<{
    universeId: z.ZodString;
    plannedStartDate: z.ZodString;
    plannedEndDate: z.ZodString;
    priority: z.ZodNativeEnum<typeof AuditPriority>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    priority: AuditPriority;
    universeId: string;
    plannedStartDate: string;
    plannedEndDate: string;
    notes?: string | null | undefined;
}, {
    priority: AuditPriority;
    universeId: string;
    plannedStartDate: string;
    plannedEndDate: string;
    notes?: string | null | undefined;
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
    auditType: z.ZodOptional<z.ZodEnum<[AuditType.It, AuditType.Financial, AuditType.Compliance]>>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["year", "created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "updated_at" | "year";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    status?: PlanStatus | undefined;
    year?: number | undefined;
    auditType?: AuditType.It | AuditType.Financial | AuditType.Compliance | undefined;
}, {
    search?: string | undefined;
    status?: PlanStatus | undefined;
    year?: number | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "updated_at" | "year" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    auditType?: AuditType.It | AuditType.Financial | AuditType.Compliance | undefined;
}>;
export type CreatePlanRequestDto = z.infer<typeof CreatePlanRequestSchema>;
export type UpdatePlanRequestDto = z.infer<typeof UpdatePlanRequestSchema>;
export type AddPlanItemRequestDto = z.infer<typeof AddPlanItemRequestSchema>;
export type RejectPlanRequestDto = z.infer<typeof RejectPlanRequestSchema>;
export type PlanQueryDto = z.infer<typeof PlanQuerySchema>;
//# sourceMappingURL=planning.request.dto.d.ts.map