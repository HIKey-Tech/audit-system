import { z } from 'zod';
import { SystemDocumentStatus, SystemDocumentType } from '../../../domain/enum/system-audit.enum';
export declare const CreateSystemDocumentSchema: z.ZodObject<{
    title: z.ZodString;
    docType: z.ZodNativeEnum<typeof SystemDocumentType>;
    description: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    versionLabel: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    /** Defaults to the uploader. */
    ownerId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    universeId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    assetId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    vendor: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    effectiveDate: z.ZodEffects<z.ZodOptional<z.ZodDate>, Date | undefined, unknown>;
    reviewDueDate: z.ZodEffects<z.ZodOptional<z.ZodDate>, Date | undefined, unknown>;
    expiryDate: z.ZodEffects<z.ZodOptional<z.ZodDate>, Date | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    title: string;
    docType: SystemDocumentType;
    description?: string | undefined;
    vendor?: string | undefined;
    ownerId?: string | undefined;
    assetId?: string | undefined;
    universeId?: string | undefined;
    versionLabel?: string | undefined;
    effectiveDate?: Date | undefined;
    reviewDueDate?: Date | undefined;
    expiryDate?: Date | undefined;
}, {
    title: string;
    docType: SystemDocumentType;
    description?: unknown;
    vendor?: unknown;
    ownerId?: unknown;
    assetId?: unknown;
    universeId?: unknown;
    versionLabel?: unknown;
    effectiveDate?: unknown;
    reviewDueDate?: unknown;
    expiryDate?: unknown;
}>;
export declare const UpdateSystemDocumentSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    docType: z.ZodOptional<z.ZodNativeEnum<typeof SystemDocumentType>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    versionLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ownerId: z.ZodOptional<z.ZodString>;
    universeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    assetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    effectiveDate: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
    reviewDueDate: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
    expiryDate: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof SystemDocumentStatus>>;
}, "strip", z.ZodTypeAny, {
    status?: SystemDocumentStatus | undefined;
    title?: string | undefined;
    description?: string | null | undefined;
    vendor?: string | null | undefined;
    ownerId?: string | undefined;
    assetId?: string | null | undefined;
    universeId?: string | null | undefined;
    docType?: SystemDocumentType | undefined;
    versionLabel?: string | null | undefined;
    effectiveDate?: Date | null | undefined;
    reviewDueDate?: Date | null | undefined;
    expiryDate?: Date | null | undefined;
}, {
    status?: SystemDocumentStatus | undefined;
    title?: string | undefined;
    description?: string | null | undefined;
    vendor?: string | null | undefined;
    ownerId?: string | undefined;
    assetId?: string | null | undefined;
    universeId?: string | null | undefined;
    docType?: SystemDocumentType | undefined;
    versionLabel?: string | null | undefined;
    effectiveDate?: Date | null | undefined;
    reviewDueDate?: Date | null | undefined;
    expiryDate?: Date | null | undefined;
}>;
export declare const UploadSystemDocumentVersionSchema: z.ZodObject<{
    versionLabel: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    changeNote: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    /** A new version usually restarts the review cycle. */
    reviewDueDate: z.ZodEffects<z.ZodOptional<z.ZodDate>, Date | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    changeNote?: string | undefined;
    versionLabel?: string | undefined;
    reviewDueDate?: Date | undefined;
}, {
    changeNote?: unknown;
    versionLabel?: unknown;
    reviewDueDate?: unknown;
}>;
export declare const SystemDocumentListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    docType: z.ZodOptional<z.ZodNativeEnum<typeof SystemDocumentType>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof SystemDocumentStatus>>;
    universeId: z.ZodOptional<z.ZodString>;
    assetId: z.ZodOptional<z.ZodString>;
    /** Documents relevant to an engagement's scope: its audit-universe entity and linked assets. */
    engagementId: z.ZodOptional<z.ZodString>;
    ownerId: z.ZodOptional<z.ZodString>;
    reviewState: z.ZodOptional<z.ZodEnum<["overdue", "due_soon"]>>;
    contractState: z.ZodOptional<z.ZodEnum<["expired", "expiring"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
    status?: SystemDocumentStatus | undefined;
    ownerId?: string | undefined;
    assetId?: string | undefined;
    universeId?: string | undefined;
    engagementId?: string | undefined;
    docType?: SystemDocumentType | undefined;
    reviewState?: "overdue" | "due_soon" | undefined;
    contractState?: "expired" | "expiring" | undefined;
}, {
    search?: string | undefined;
    status?: SystemDocumentStatus | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    ownerId?: string | undefined;
    assetId?: string | undefined;
    universeId?: string | undefined;
    engagementId?: string | undefined;
    docType?: SystemDocumentType | undefined;
    reviewState?: "overdue" | "due_soon" | undefined;
    contractState?: "expired" | "expiring" | undefined;
}>;
export type CreateSystemDocumentDto = z.infer<typeof CreateSystemDocumentSchema>;
export type UpdateSystemDocumentDto = z.infer<typeof UpdateSystemDocumentSchema>;
export type UploadSystemDocumentVersionDto = z.infer<typeof UploadSystemDocumentVersionSchema>;
export type SystemDocumentListQueryDto = z.infer<typeof SystemDocumentListQuerySchema>;
//# sourceMappingURL=documentation.request.dto.d.ts.map