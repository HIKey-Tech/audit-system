import { z } from 'zod';
import { SystemDocumentStatus, SystemDocumentType } from '../../../domain/enum/system-audit.enum';

// Multipart forms send absent optional fields as empty strings.
const blankToUndefined = (value: unknown): unknown => (value === '' || value === 'null' ? undefined : value);
const OptionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const OptionalUuid = z.preprocess(blankToUndefined, z.string().uuid().optional());
const OptionalDate = z.preprocess(blankToUndefined, z.coerce.date().optional());
// JSON updates may clear a field with null.
const NullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const NullableDate = z.coerce.date().nullable().optional();

export const CreateSystemDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  docType: z.nativeEnum(SystemDocumentType),
  description: OptionalText(4000),
  versionLabel: OptionalText(50),
  /** Defaults to the uploader. */
  ownerId: OptionalUuid,
  universeId: OptionalUuid,
  assetId: OptionalUuid,
  vendor: OptionalText(200),
  effectiveDate: OptionalDate,
  reviewDueDate: OptionalDate,
  expiryDate: OptionalDate,
});

export const UpdateSystemDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  docType: z.nativeEnum(SystemDocumentType).optional(),
  description: NullableText(4000),
  versionLabel: NullableText(50),
  ownerId: z.string().uuid().optional(),
  universeId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  vendor: NullableText(200),
  effectiveDate: NullableDate,
  reviewDueDate: NullableDate,
  expiryDate: NullableDate,
  status: z.nativeEnum(SystemDocumentStatus).optional(),
});

export const UploadSystemDocumentVersionSchema = z.object({
  versionLabel: OptionalText(50),
  changeNote: OptionalText(500),
  /** A new version usually restarts the review cycle. */
  reviewDueDate: OptionalDate,
});

export const SystemDocumentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  docType: z.nativeEnum(SystemDocumentType).optional(),
  status: z.nativeEnum(SystemDocumentStatus).optional(),
  universeId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  /** Documents relevant to an engagement's scope: its audit-universe entity and linked assets. */
  engagementId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  reviewState: z.enum(['overdue', 'due_soon']).optional(),
  contractState: z.enum(['expired', 'expiring']).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export type CreateSystemDocumentDto = z.infer<typeof CreateSystemDocumentSchema>;
export type UpdateSystemDocumentDto = z.infer<typeof UpdateSystemDocumentSchema>;
export type UploadSystemDocumentVersionDto = z.infer<typeof UploadSystemDocumentVersionSchema>;
export type SystemDocumentListQueryDto = z.infer<typeof SystemDocumentListQuerySchema>;
