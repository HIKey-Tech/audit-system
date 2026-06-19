import { z } from 'zod';
export declare const SetSignatureMetadataSchema: z.ZodObject<{
    kind: z.ZodEnum<["drawn", "uploaded"]>;
}, "strip", z.ZodTypeAny, {
    kind: "drawn" | "uploaded";
}, {
    kind: "drawn" | "uploaded";
}>;
export type SetSignatureMetadataDto = z.infer<typeof SetSignatureMetadataSchema>;
/** Service-layer input: the PNG/JPG buffer parsed out of req.file by multer. */
export interface SetSignatureDto {
    userId: string;
    kind: 'drawn' | 'uploaded';
    originalName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
}
//# sourceMappingURL=signature.request.dto.d.ts.map