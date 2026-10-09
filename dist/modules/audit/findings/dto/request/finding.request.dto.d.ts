import { z } from 'zod';
import { FindingCategory, FindingSeverity, FindingStatus } from '../../../domain/enum/audit.enum';
export declare const CreateFindingRequestSchema: z.ZodObject<{
    workingPaperId: z.ZodOptional<z.ZodString>;
    checklistId: z.ZodOptional<z.ZodString>;
    riskId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<[FindingCategory.It, FindingCategory.Financial, FindingCategory.Compliance, FindingCategory.Operational]>;
    severity: z.ZodNativeEnum<typeof FindingSeverity>;
    rootCause: z.ZodString;
    riskImplication: z.ZodString;
    recommendation: z.ZodString;
    auditeeId: z.ZodString;
    /** Co-responders who may also answer this finding alongside the primary auditee. */
    additionalAuditeeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dueDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    category: FindingCategory.It | FindingCategory.Financial | FindingCategory.Compliance | FindingCategory.Operational;
    severity: FindingSeverity;
    recommendation: string;
    auditeeId: string;
    rootCause: string;
    riskImplication: string;
    dueDate: string;
    riskId?: string | undefined;
    workingPaperId?: string | undefined;
    checklistId?: string | undefined;
    additionalAuditeeIds?: string[] | undefined;
}, {
    title: string;
    description: string;
    category: FindingCategory.It | FindingCategory.Financial | FindingCategory.Compliance | FindingCategory.Operational;
    severity: FindingSeverity;
    recommendation: string;
    auditeeId: string;
    rootCause: string;
    riskImplication: string;
    dueDate: string;
    riskId?: string | undefined;
    workingPaperId?: string | undefined;
    checklistId?: string | undefined;
    additionalAuditeeIds?: string[] | undefined;
}>;
export declare const UpdateFindingRequestSchema: z.ZodObject<{
    workingPaperId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    checklistId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    riskId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<[FindingCategory.It, FindingCategory.Financial, FindingCategory.Compliance, FindingCategory.Operational]>>;
    severity: z.ZodOptional<z.ZodNativeEnum<typeof FindingSeverity>>;
    rootCause: z.ZodOptional<z.ZodString>;
    riskImplication: z.ZodOptional<z.ZodString>;
    recommendation: z.ZodOptional<z.ZodString>;
    auditeeId: z.ZodOptional<z.ZodString>;
    /** When provided, replaces the full set of co-responders for this finding. */
    additionalAuditeeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dueDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | undefined;
    category?: FindingCategory.It | FindingCategory.Financial | FindingCategory.Compliance | FindingCategory.Operational | undefined;
    severity?: FindingSeverity | undefined;
    recommendation?: string | undefined;
    riskId?: string | null | undefined;
    auditeeId?: string | undefined;
    workingPaperId?: string | null | undefined;
    checklistId?: string | null | undefined;
    rootCause?: string | undefined;
    riskImplication?: string | undefined;
    additionalAuditeeIds?: string[] | undefined;
    dueDate?: string | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    category?: FindingCategory.It | FindingCategory.Financial | FindingCategory.Compliance | FindingCategory.Operational | undefined;
    severity?: FindingSeverity | undefined;
    recommendation?: string | undefined;
    riskId?: string | null | undefined;
    auditeeId?: string | undefined;
    workingPaperId?: string | null | undefined;
    checklistId?: string | null | undefined;
    rootCause?: string | undefined;
    riskImplication?: string | undefined;
    additionalAuditeeIds?: string[] | undefined;
    dueDate?: string | undefined;
}>;
export declare const UpdateFindingStatusRequestSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof FindingStatus>;
}, "strip", z.ZodTypeAny, {
    status: FindingStatus;
}, {
    status: FindingStatus;
}>;
export declare const FindingQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodNativeEnum<typeof FindingSeverity>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof FindingStatus>>;
    category: z.ZodOptional<z.ZodEnum<[FindingCategory.It, FindingCategory.Financial, FindingCategory.Compliance, FindingCategory.Operational]>>;
    controlReference: z.ZodOptional<z.ZodString>;
    auditeeId: z.ZodOptional<z.ZodString>;
    riskId: z.ZodOptional<z.ZodString>;
    universeId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["created_at", "updated_at", "due_date", "severity", "status"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "updated_at" | "status" | "due_date" | "severity";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    status?: FindingStatus | undefined;
    category?: FindingCategory.It | FindingCategory.Financial | FindingCategory.Compliance | FindingCategory.Operational | undefined;
    severity?: FindingSeverity | undefined;
    universeId?: string | undefined;
    riskId?: string | undefined;
    controlReference?: string | undefined;
    auditeeId?: string | undefined;
}, {
    search?: string | undefined;
    status?: FindingStatus | undefined;
    category?: FindingCategory.It | FindingCategory.Financial | FindingCategory.Compliance | FindingCategory.Operational | undefined;
    severity?: FindingSeverity | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "updated_at" | "status" | "due_date" | "severity" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    universeId?: string | undefined;
    riskId?: string | undefined;
    controlReference?: string | undefined;
    auditeeId?: string | undefined;
}>;
export declare const FindingExportQuerySchema: z.ZodObject<Omit<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodNativeEnum<typeof FindingSeverity>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof FindingStatus>>;
    category: z.ZodOptional<z.ZodEnum<[FindingCategory.It, FindingCategory.Financial, FindingCategory.Compliance, FindingCategory.Operational]>>;
    controlReference: z.ZodOptional<z.ZodString>;
    auditeeId: z.ZodOptional<z.ZodString>;
    riskId: z.ZodOptional<z.ZodString>;
    universeId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["created_at", "updated_at", "due_date", "severity", "status"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "page" | "pageSize"> & {
    format: z.ZodDefault<z.ZodEnum<["csv", "xlsx"]>>;
}, "strip", z.ZodTypeAny, {
    format: "csv" | "xlsx";
    sortBy: "created_at" | "updated_at" | "status" | "due_date" | "severity";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    status?: FindingStatus | undefined;
    category?: FindingCategory.It | FindingCategory.Financial | FindingCategory.Compliance | FindingCategory.Operational | undefined;
    severity?: FindingSeverity | undefined;
    universeId?: string | undefined;
    riskId?: string | undefined;
    controlReference?: string | undefined;
    auditeeId?: string | undefined;
}, {
    format?: "csv" | "xlsx" | undefined;
    search?: string | undefined;
    status?: FindingStatus | undefined;
    category?: FindingCategory.It | FindingCategory.Financial | FindingCategory.Compliance | FindingCategory.Operational | undefined;
    severity?: FindingSeverity | undefined;
    sortBy?: "created_at" | "updated_at" | "status" | "due_date" | "severity" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    universeId?: string | undefined;
    riskId?: string | undefined;
    controlReference?: string | undefined;
    auditeeId?: string | undefined;
}>;
export type CreateFindingRequestDto = z.infer<typeof CreateFindingRequestSchema>;
export type UpdateFindingRequestDto = z.infer<typeof UpdateFindingRequestSchema>;
export type UpdateFindingStatusRequestDto = z.infer<typeof UpdateFindingStatusRequestSchema>;
export type FindingQueryDto = z.infer<typeof FindingQuerySchema>;
export type FindingExportQueryDto = z.infer<typeof FindingExportQuerySchema>;
//# sourceMappingURL=finding.request.dto.d.ts.map