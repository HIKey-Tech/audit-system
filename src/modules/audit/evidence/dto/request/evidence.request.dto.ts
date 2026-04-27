import { z } from 'zod';

export const UploadEvidenceMetadataSchema = z.object({
  workingPaperId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
});

export const EvidenceQuerySchema = z.object({
  workingPaperId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
});

export const DisputeEvidenceRequestSchema = z.object({
  reason: z.string().min(1).max(5000),
});

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
