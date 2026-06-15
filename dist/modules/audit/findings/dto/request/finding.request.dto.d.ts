import { z } from 'zod';
import { FindingCategory, FindingSeverity, FindingStatus } from '../../../domain/enum/audit.enum';
export declare const CreateFindingRequestSchema: z.ZodObject<{
    workingPaperId: z.ZodOptional<z.ZodString>;
    checklistId: z.ZodOptional<z.ZodString>;
    riskId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodString;
    category: z.ZodNativeEnum<typeof FindingCategory>;
    severity: z.ZodNativeEnum<typeof FindingSeverity>;
    rootCause: z.ZodString;
    riskImplication: z.ZodString;
    recommendation: z.ZodString;
    auditeeId: z.ZodString;
    dueDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    category: FindingCategory;
    severity: FindingSeverity;
    recommendation: string;
    auditeeId: string;
    rootCause: string;
    riskImplication: string;
    dueDate: string;
    riskId?: string | undefined;
    workingPaperId?: string | undefined;
    checklistId?: string | undefined;
}, {
    title: string;
    description: string;
    category: FindingCategory;
    severity: FindingSeverity;
    recommendation: string;
    auditeeId: string;
    rootCause: string;
    riskImplication: string;
    dueDate: string;
    riskId?: string | undefined;
    workingPaperId?: string | undefined;
    checklistId?: string | undefined;
}>;
export declare const UpdateFindingRequestSchema: z.ZodObject<{
    workingPaperId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    checklistId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    riskId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodNativeEnum<typeof FindingCategory>>;
    severity: z.ZodOptional<z.ZodNativeEnum<typeof FindingSeverity>>;
    rootCause: z.ZodOptional<z.ZodString>;
    riskImplication: z.ZodOptional<z.ZodString>;
    recommendation: z.ZodOptional<z.ZodString>;
    auditeeId: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | undefined;
    category?: FindingCategory | undefined;
    severity?: FindingSeverity | undefined;
    recommendation?: string | undefined;
    riskId?: string | null | undefined;
    auditeeId?: string | undefined;
    workingPaperId?: string | null | undefined;
    checklistId?: string | null | undefined;
    rootCause?: string | undefined;
    riskImplication?: string | undefined;
    dueDate?: string | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    category?: FindingCategory | undefined;
    severity?: FindingSeverity | undefined;
    recommendation?: string | undefined;
    riskId?: string | null | undefined;
    auditeeId?: string | undefined;
    workingPaperId?: string | null | undefined;
    checklistId?: string | null | undefined;
    rootCause?: string | undefined;
    riskImplication?: string | undefined;
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
    category: z.ZodOptional<z.ZodNativeEnum<typeof FindingCategory>>;
    controlReference: z.ZodOptional<z.ZodString>;
    auditeeId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["created_at", "updated_at", "due_date", "severity", "status"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "updated_at" | "status" | "severity" | "due_date";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    status?: FindingStatus | undefined;
    category?: FindingCategory | undefined;
    severity?: FindingSeverity | undefined;
    controlReference?: string | undefined;
    auditeeId?: string | undefined;
}, {
    search?: string | undefined;
    status?: FindingStatus | undefined;
    category?: FindingCategory | undefined;
    severity?: FindingSeverity | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "updated_at" | "status" | "severity" | "due_date" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    controlReference?: string | undefined;
    auditeeId?: string | undefined;
}>;
export type CreateFindingRequestDto = z.infer<typeof CreateFindingRequestSchema>;
export type UpdateFindingRequestDto = z.infer<typeof UpdateFindingRequestSchema>;
export type UpdateFindingStatusRequestDto = z.infer<typeof UpdateFindingStatusRequestSchema>;
export type FindingQueryDto = z.infer<typeof FindingQuerySchema>;
//# sourceMappingURL=finding.request.dto.d.ts.map