import { z } from 'zod';

export const UploadEvidenceMetadataSchema = z.object({
  workingPaperId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
});

export const EvidenceQuerySchema = z.object({
  workingPaperId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
});

/**
 * Centralized evidence repository query — a cross-engagement view over all
 * audit evidence. Values arrive as query-string strings, so numbers/booleans/
 * dates are coerced. Pagination keys (page/pageSize) are consumed by
 * parsePagination in the service.
 */
export const EvidenceRepositoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  engagementId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
  workingPaperId: z.string().uuid().optional(),
  uploadedById: z.string().uuid().optional(),
  fileType: z.string().min(1).max(100).optional(),
  isDisputed: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  uploadedFrom: z.coerce.date().optional(),
  uploadedTo: z.coerce.date().optional(),
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
export type EvidenceRepositoryQueryDto = z.infer<typeof EvidenceRepositoryQuerySchema>;
export type DisputeEvidenceRequestDto = z.infer<typeof DisputeEvidenceRequestSchema>;
