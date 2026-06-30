import { z } from 'zod';
export declare const UploadEvidenceMetadataSchema: z.ZodObject<{
    workingPaperId: z.ZodOptional<z.ZodString>;
    findingId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    findingId?: string | undefined;
    workingPaperId?: string | undefined;
}, {
    findingId?: string | undefined;
    workingPaperId?: string | undefined;
}>;
export declare const EvidenceQuerySchema: z.ZodObject<{
    workingPaperId: z.ZodOptional<z.ZodString>;
    findingId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    findingId?: string | undefined;
    workingPaperId?: string | undefined;
}, {
    findingId?: string | undefined;
    workingPaperId?: string | undefined;
}>;
/**
 * Centralized evidence repository query — a cross-engagement view over all
 * audit evidence. Values arrive as query-string strings, so numbers/booleans/
 * dates are coerced. Pagination keys (page/pageSize) are consumed by
 * parsePagination in the service.
 */
export declare const EvidenceRepositoryQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    engagementId: z.ZodOptional<z.ZodString>;
    findingId: z.ZodOptional<z.ZodString>;
    workingPaperId: z.ZodOptional<z.ZodString>;
    uploadedById: z.ZodOptional<z.ZodString>;
    fileType: z.ZodOptional<z.ZodString>;
    isDisputed: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
    uploadedFrom: z.ZodOptional<z.ZodDate>;
    uploadedTo: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    uploadedById?: string | undefined;
    findingId?: string | undefined;
    engagementId?: string | undefined;
    fileType?: string | undefined;
    workingPaperId?: string | undefined;
    isDisputed?: boolean | undefined;
    uploadedFrom?: Date | undefined;
    uploadedTo?: Date | undefined;
}, {
    search?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    uploadedById?: string | undefined;
    findingId?: string | undefined;
    engagementId?: string | undefined;
    fileType?: string | undefined;
    workingPaperId?: string | undefined;
    isDisputed?: "true" | "false" | undefined;
    uploadedFrom?: Date | undefined;
    uploadedTo?: Date | undefined;
}>;
export declare const DisputeEvidenceRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export interface UploadEvidenceDto {
    workingPaperId?: string;
    findingId?: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
}
export type UploadEvidenceMetadataDto = z.infer<typeof UploadEvidenceMetadataSchema>;
export type EvidenceQueryDto = z.infer<typeof EvidenceQuerySchema>;
export type EvidenceRepositoryQueryDto = z.infer<typeof EvidenceRepositoryQuerySchema>;
export type DisputeEvidenceRequestDto = z.infer<typeof DisputeEvidenceRequestSchema>;
//# sourceMappingURL=evidence.request.dto.d.ts.map