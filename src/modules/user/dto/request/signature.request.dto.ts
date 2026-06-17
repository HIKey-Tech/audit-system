// src/modules/user/dto/request/signature.request.dto.ts
import { z } from 'zod';

export const SetSignatureMetadataSchema = z.object({
  kind: z.enum(['drawn', 'uploaded']),
});

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
