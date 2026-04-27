import { z } from 'zod';
import { AuditPriority, AuditType, EngagementStatus } from '../../../domain/enum/audit.enum';
export declare const CreateEngagementFromPlanRequestSchema: z.ZodObject<{
    title: z.ZodString;
    universeId: z.ZodString;
    auditType: z.ZodNativeEnum<typeof AuditType>;
    priority: z.ZodNativeEnum<typeof AuditPriority>;
    leadAuditorId: z.ZodString;
    auditManagerId: z.ZodString;
    auditeeId: z.ZodString;
    plannedStartDate: z.ZodString;
    plannedEndDate: z.ZodString;
    slaDeadline: z.ZodString;
} & {
    planItemId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    priority: AuditPriority;
    universeId: string;
    auditType: AuditType;
    plannedStartDate: string;
    plannedEndDate: string;
    leadAuditorId: string;
    auditManagerId: string;
    auditeeId: string;
    slaDeadline: string;
    planItemId: string;
}, {
    title: string;
    priority: AuditPriority;
    universeId: string;
    auditType: AuditType;
    plannedStartDate: string;
    plannedEndDate: string;
    leadAuditorId: string;
    auditManagerId: string;
    auditeeId: string;
    slaDeadline: string;
    planItemId: string;
}>;
export declare const CreateAdhocEngagementRequestSchema: z.ZodObject<{
    title: z.ZodString;
    universeId: z.ZodString;
    auditType: z.ZodNativeEnum<typeof AuditType>;
    priority: z.ZodNativeEnum<typeof AuditPriority>;
    leadAuditorId: z.ZodString;
    auditManagerId: z.ZodString;
    auditeeId: z.ZodString;
    plannedStartDate: z.ZodString;
    plannedEndDate: z.ZodString;
    slaDeadline: z.ZodString;
} & {
    adhocReason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    priority: AuditPriority;
    universeId: string;
    auditType: AuditType;
    plannedStartDate: string;
    plannedEndDate: string;
    leadAuditorId: string;
    auditManagerId: string;
    auditeeId: string;
    slaDeadline: string;
    adhocReason: string;
}, {
    title: string;
    priority: AuditPriority;
    universeId: string;
    auditType: AuditType;
    plannedStartDate: string;
    plannedEndDate: string;
    leadAuditorId: string;
    auditManagerId: string;
    auditeeId: string;
    slaDeadline: string;
    adhocReason: string;
}>;
export declare const UpdateEngagementRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    leadAuditorId: z.ZodOptional<z.ZodString>;
    auditManagerId: z.ZodOptional<z.ZodString>;
    auditeeId: z.ZodOptional<z.ZodString>;
    plannedStartDate: z.ZodOptional<z.ZodString>;
    plannedEndDate: z.ZodOptional<z.ZodString>;
    slaDeadline: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNativeEnum<typeof AuditPriority>>;
    adhocReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    priority?: AuditPriority | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
    leadAuditorId?: string | undefined;
    auditManagerId?: string | undefined;
    auditeeId?: string | undefined;
    slaDeadline?: string | undefined;
    adhocReason?: string | null | undefined;
}, {
    title?: string | undefined;
    priority?: AuditPriority | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
    leadAuditorId?: string | undefined;
    auditManagerId?: string | undefined;
    auditeeId?: string | undefined;
    slaDeadline?: string | undefined;
    adhocReason?: string | null | undefined;
}>;
export declare const UpdateEngagementStatusRequestSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof EngagementStatus>;
}, "strip", z.ZodTypeAny, {
    status: EngagementStatus;
}, {
    status: EngagementStatus;
}>;
export declare const EngagementQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof EngagementStatus>>;
    auditType: z.ZodOptional<z.ZodNativeEnum<typeof AuditType>>;
    leadAuditorId: z.ZodOptional<z.ZodString>;
    auditManagerId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["created_at", "planned_start_date", "sla_deadline", "reference_number"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "reference_number" | "planned_start_date" | "sla_deadline";
    sortOrder: "asc" | "desc";
    status?: EngagementStatus | undefined;
    auditType?: AuditType | undefined;
    leadAuditorId?: string | undefined;
    auditManagerId?: string | undefined;
}, {
    status?: EngagementStatus | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "reference_number" | "planned_start_date" | "sla_deadline" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    auditType?: AuditType | undefined;
    leadAuditorId?: string | undefined;
    auditManagerId?: string | undefined;
}>;
export type CreateEngagementFromPlanRequestDto = z.infer<typeof CreateEngagementFromPlanRequestSchema>;
export type CreateAdhocEngagementRequestDto = z.infer<typeof CreateAdhocEngagementRequestSchema>;
export type UpdateEngagementRequestDto = z.infer<typeof UpdateEngagementRequestSchema>;
export type UpdateEngagementStatusRequestDto = z.infer<typeof UpdateEngagementStatusRequestSchema>;
export type EngagementQueryDto = z.infer<typeof EngagementQuerySchema>;
//# sourceMappingURL=engagement.request.dto.d.ts.map