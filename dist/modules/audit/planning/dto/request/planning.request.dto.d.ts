import { z } from 'zod';
import { AuditPriority, PlanStatus } from '../../../domain/enum/audit.enum';
export declare const CreatePlanRequestSchema: z.ZodObject<{
    title: z.ZodString;
    year: z.ZodNumber;
    auditType: z.ZodEnum<[import("../../../domain/enum/audit.enum").AuditType.It, import("../../../domain/enum/audit.enum").AuditType.Systems, import("../../../domain/enum/audit.enum").AuditType.Financial, import("../../../domain/enum/audit.enum").AuditType.Compliance, import("../../../domain/enum/audit.enum").AuditType.Operational, import("../../../domain/enum/audit.enum").AuditType.Pension, import("../../../domain/enum/audit.enum").AuditType.Procurement, import("../../../domain/enum/audit.enum").AuditType.HrPayroll, import("../../../domain/enum/audit.enum").AuditType.Project, import("../../../domain/enum/audit.enum").AuditType.Special]>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    year: number;
    auditType: import("../../../domain/enum/audit.enum").AuditType;
    description?: string | undefined;
}, {
    title: string;
    year: number;
    auditType: import("../../../domain/enum/audit.enum").AuditType;
    description?: string | undefined;
}>;
export declare const UpdatePlanRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    year: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | null | undefined;
    year?: number | undefined;
}, {
    title?: string | undefined;
    description?: string | null | undefined;
    year?: number | undefined;
}>;
export declare const AddPlanItemRequestSchema: z.ZodEffects<z.ZodObject<{
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
}>, {
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
export declare const UpdatePlanItemRequestSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    universeId: z.ZodOptional<z.ZodString>;
    plannedStartDate: z.ZodOptional<z.ZodString>;
    plannedEndDate: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNativeEnum<typeof AuditPriority>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    priority?: AuditPriority | undefined;
    notes?: string | null | undefined;
    universeId?: string | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
}, {
    priority?: AuditPriority | undefined;
    notes?: string | null | undefined;
    universeId?: string | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
}>, {
    priority?: AuditPriority | undefined;
    notes?: string | null | undefined;
    universeId?: string | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
}, {
    priority?: AuditPriority | undefined;
    notes?: string | null | undefined;
    universeId?: string | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
}>, {
    priority?: AuditPriority | undefined;
    notes?: string | null | undefined;
    universeId?: string | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
}, {
    priority?: AuditPriority | undefined;
    notes?: string | null | undefined;
    universeId?: string | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
}>;
export declare const BulkAddPlanItemsRequestSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodEffects<z.ZodObject<{
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
    }>, {
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
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        priority: AuditPriority;
        universeId: string;
        plannedStartDate: string;
        plannedEndDate: string;
        notes?: string | null | undefined;
    }[];
}, {
    items: {
        priority: AuditPriority;
        universeId: string;
        plannedStartDate: string;
        plannedEndDate: string;
        notes?: string | null | undefined;
    }[];
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
    auditType: z.ZodOptional<z.ZodEnum<[import("../../../domain/enum/audit.enum").AuditType.It, import("../../../domain/enum/audit.enum").AuditType.Systems, import("../../../domain/enum/audit.enum").AuditType.Financial, import("../../../domain/enum/audit.enum").AuditType.Compliance, import("../../../domain/enum/audit.enum").AuditType.Operational, import("../../../domain/enum/audit.enum").AuditType.Pension, import("../../../domain/enum/audit.enum").AuditType.Procurement, import("../../../domain/enum/audit.enum").AuditType.HrPayroll, import("../../../domain/enum/audit.enum").AuditType.Project, import("../../../domain/enum/audit.enum").AuditType.Special]>>;
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
    auditType?: import("../../../domain/enum/audit.enum").AuditType | undefined;
}, {
    search?: string | undefined;
    status?: PlanStatus | undefined;
    year?: number | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "updated_at" | "year" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    auditType?: import("../../../domain/enum/audit.enum").AuditType | undefined;
}>;
export type CreatePlanRequestDto = z.infer<typeof CreatePlanRequestSchema>;
export type UpdatePlanRequestDto = z.infer<typeof UpdatePlanRequestSchema>;
export type AddPlanItemRequestDto = z.infer<typeof AddPlanItemRequestSchema>;
export type UpdatePlanItemRequestDto = z.infer<typeof UpdatePlanItemRequestSchema>;
export type BulkAddPlanItemsRequestDto = z.infer<typeof BulkAddPlanItemsRequestSchema>;
export type RejectPlanRequestDto = z.infer<typeof RejectPlanRequestSchema>;
export type PlanQueryDto = z.infer<typeof PlanQuerySchema>;
//# sourceMappingURL=planning.request.dto.d.ts.map