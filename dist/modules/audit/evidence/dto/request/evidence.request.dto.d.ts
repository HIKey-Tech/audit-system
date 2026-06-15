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
export type DisputeEvidenceRequestDto = z.infer<typeof DisputeEvidenceRequestSchema>;
//# sourceMappingURL=evidence.request.dto.d.ts.map