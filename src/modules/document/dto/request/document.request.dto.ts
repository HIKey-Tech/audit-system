// src/modules/document/dto/request/document.request.dto.ts
import { z } from 'zod';
import { TemplateCategory } from '../../domain/enum/document.enum';

// ──────────────────────────────────────────────────────────────
// Service input DTOs (non-HTTP; carry the multipart file buffer
// already parsed out of req.file by multer)
// ──────────────────────────────────────────────────────────────
export interface UploadDocumentDto {
  uploadedById: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  module: string;
  entityType?: string;
  entityId?: string;
}

export interface UploadVersionDto {
  uploadedById: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  changeNote?: string;
}

// ──────────────────────────────────────────────────────────────
// Document upload (multipart metadata — the file buffer is
// parsed out of req.file separately by multer)
// ──────────────────────────────────────────────────────────────
export const UploadDocumentMetadataSchema = z.object({
  module: z.string().min(1).max(100),
  entityType: z.string().min(1).max(100).optional(),
  entityId: z.string().uuid().optional(),
});

// ──────────────────────────────────────────────────────────────
// New version upload (multipart metadata)
// ──────────────────────────────────────────────────────────────
export const UploadVersionMetadataSchema = z.object({
  changeNote: z.string().max(1000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Document listing query
// ──────────────────────────────────────────────────────────────
export const DocumentByEntityParamsSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
});

export const DocumentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const DocumentVersionParamsSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

// ──────────────────────────────────────────────────────────────
// Template CRUD
// ──────────────────────────────────────────────────────────────
const TemplateCategorySchema = z.nativeEnum(TemplateCategory);

export const CreateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: TemplateCategorySchema,
  content: z.string().optional(),
  documentId: z.string().uuid().optional(),
  metadata: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: TemplateCategorySchema.optional(),
  content: z.string().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  metadata: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const TemplateQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  category: TemplateCategorySchema.optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'category', 'created_at', 'updated_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type UploadDocumentMetadataDto = z.infer<typeof UploadDocumentMetadataSchema>;
export type UploadVersionMetadataDto = z.infer<typeof UploadVersionMetadataSchema>;
export type CreateTemplateRequestDto = z.infer<typeof CreateTemplateRequestSchema>;
export type UpdateTemplateRequestDto = z.infer<typeof UpdateTemplateRequestSchema>;
export type TemplateQueryDto = z.infer<typeof TemplateQuerySchema>;
