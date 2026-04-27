import { z } from 'zod';
import { FindingCategory, FindingSeverity, FindingStatus } from '../../../domain/enum/audit.enum';
export declare const CreateFindingRequestSchema: z.ZodObject<{
    workingPaperId: z.ZodOptional<z.ZodString>;
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
    workingPaperId?: string | undefined;
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
    workingPaperId?: string | undefined;
}>;
export declare const UpdateFindingRequestSchema: z.ZodObject<{
    workingPaperId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
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
    auditeeId?: string | undefined;
    workingPaperId?: string | null | undefined;
    rootCause?: string | undefined;
    riskImplication?: string | undefined;
    dueDate?: string | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    category?: FindingCategory | undefined;
    severity?: FindingSeverity | undefined;
    recommendation?: string | undefined;
    auditeeId?: string | undefined;
    workingPaperId?: string | null | undefined;
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
    severity: z.ZodOptional<z.ZodNativeEnum<typeof FindingSeverity>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof FindingStatus>>;
    category: z.ZodOptional<z.ZodNativeEnum<typeof FindingCategory>>;
    auditeeId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: FindingStatus | undefined;
    category?: FindingCategory | undefined;
    severity?: FindingSeverity | undefined;
    auditeeId?: string | undefined;
}, {
    status?: FindingStatus | undefined;
    category?: FindingCategory | undefined;
    severity?: FindingSeverity | undefined;
    auditeeId?: string | undefined;
}>;
export type CreateFindingRequestDto = z.infer<typeof CreateFindingRequestSchema>;
export type UpdateFindingRequestDto = z.infer<typeof UpdateFindingRequestSchema>;
export type UpdateFindingStatusRequestDto = z.infer<typeof UpdateFindingStatusRequestSchema>;
export type FindingQueryDto = z.infer<typeof FindingQuerySchema>;
//# sourceMappingURL=finding.request.dto.d.ts.map