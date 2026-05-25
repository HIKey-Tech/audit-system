"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentListQuerySchema = exports.TemplateQuerySchema = exports.UpdateTemplateRequestSchema = exports.CreateTemplateRequestSchema = exports.DocumentVersionParamsSchema = exports.DocumentIdParamsSchema = exports.DocumentByEntityParamsSchema = exports.UploadVersionMetadataSchema = exports.UploadDocumentMetadataSchema = void 0;
// src/modules/document/dto/request/document.request.dto.ts
const zod_1 = require("zod");
const document_enum_1 = require("../../domain/enum/document.enum");
// ──────────────────────────────────────────────────────────────
// Document upload (multipart metadata — the file buffer is
// parsed out of req.file separately by multer)
// ──────────────────────────────────────────────────────────────
exports.UploadDocumentMetadataSchema = zod_1.z.object({
    module: zod_1.z.string().min(1).max(100),
    entityType: zod_1.z.string().min(1).max(100).optional(),
    entityId: zod_1.z.string().uuid().optional(),
});
// ──────────────────────────────────────────────────────────────
// New version upload (multipart metadata)
// ──────────────────────────────────────────────────────────────
exports.UploadVersionMetadataSchema = zod_1.z.object({
    changeNote: zod_1.z.string().max(1000).optional(),
});
// ──────────────────────────────────────────────────────────────
// Document listing query
// ──────────────────────────────────────────────────────────────
exports.DocumentByEntityParamsSchema = zod_1.z.object({
    entityType: zod_1.z.string().min(1),
    entityId: zod_1.z.string().uuid(),
});
exports.DocumentIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.DocumentVersionParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    version: zod_1.z.coerce.number().int().positive(),
});
// ──────────────────────────────────────────────────────────────
// Template CRUD
// ──────────────────────────────────────────────────────────────
const TemplateCategorySchema = zod_1.z.nativeEnum(document_enum_1.TemplateCategory);
exports.CreateTemplateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(1000).optional(),
    category: TemplateCategorySchema,
    content: zod_1.z.string().optional(),
    documentId: zod_1.z.string().uuid().optional(),
    metadata: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.UpdateTemplateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(1000).nullable().optional(),
    category: TemplateCategorySchema.optional(),
    content: zod_1.z.string().nullable().optional(),
    documentId: zod_1.z.string().uuid().nullable().optional(),
    metadata: zod_1.z.string().nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.TemplateQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    search: zod_1.z.string().optional(),
    category: TemplateCategorySchema.optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
    sortBy: zod_1.z.enum(['name', 'category', 'created_at', 'updated_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
// ──────────────────────────────────────────────────────────────
// Global document listing (paginated, filterable)
// ──────────────────────────────────────────────────────────────
exports.DocumentListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    entityType: zod_1.z.string().trim().min(1).optional(),
});
//# sourceMappingURL=document.request.dto.js.map