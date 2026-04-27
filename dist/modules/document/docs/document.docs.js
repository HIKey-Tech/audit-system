"use strict";
// src/modules/document/docs/document.docs.ts
//
// OpenAPI registration for /documents/* routes. Imported for side-effects
// from `modules/document/index.ts`.
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const openapi_util_1 = require("../../../shared/docs/openapi.util");
const document_request_dto_1 = require("../dto/request/document.request.dto");
const tag = 'Documents';
const DocumentIdParam = zod_1.z.object({
    id: zod_1.z.string().uuid().openapi({ description: 'Document UUID' }),
});
const DocumentVersionParams = zod_1.z.object({
    id: zod_1.z.string().uuid().openapi({ description: 'Document UUID' }),
    version: zod_1.z.coerce.number().int().positive().openapi({ description: 'Version number' }),
});
const EntityParams = zod_1.z.object({
    entityType: zod_1.z.string().openapi({ description: 'Entity type (e.g. audit_engagement)' }),
    entityId: zod_1.z.string().uuid().openapi({ description: 'Entity UUID' }),
});
const TemplateIdParam = zod_1.z.object({
    id: zod_1.z.string().uuid().openapi({ description: 'Template UUID' }),
});
const MultipartUploadSchema = zod_1.z
    .object({
    file: zod_1.z.any().openapi({ type: 'string', format: 'binary' }),
    module: zod_1.z.string().openapi({ description: 'Owning module (e.g. audit, finding)' }),
    entityType: zod_1.z.string().optional(),
    entityId: zod_1.z.string().uuid().optional(),
})
    .openapi('DocumentUpload');
const MultipartVersionSchema = zod_1.z
    .object({
    file: zod_1.z.any().openapi({ type: 'string', format: 'binary' }),
    changeNote: zod_1.z.string().optional(),
})
    .openapi('DocumentVersionUpload');
const okResponse = (description) => ({
    description,
    content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
});
// ────────── Templates ──────────
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/documents/templates',
    tags: [tag],
    summary: 'Create a document template. Requires `document:write`.',
    security: openapi_util_1.bearerAuth,
    request: {
        body: {
            content: { 'application/json': { schema: document_request_dto_1.CreateTemplateRequestSchema } },
        },
    },
    responses: {
        201: okResponse('Template created'),
        409: okResponse('Template name already exists'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/templates',
    tags: [tag],
    summary: 'List templates (paginated). Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: { query: document_request_dto_1.TemplateQuerySchema },
    responses: { 200: okResponse('Paginated template list') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/templates/{id}',
    tags: [tag],
    summary: 'Get a template by ID. Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: { params: TemplateIdParam },
    responses: {
        200: okResponse('Template returned'),
        404: okResponse('Template not found'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'patch',
    path: '/documents/templates/{id}',
    tags: [tag],
    summary: 'Update a template. Requires `document:write`.',
    security: openapi_util_1.bearerAuth,
    request: {
        params: TemplateIdParam,
        body: {
            content: { 'application/json': { schema: document_request_dto_1.UpdateTemplateRequestSchema } },
        },
    },
    responses: { 200: okResponse('Template updated') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'delete',
    path: '/documents/templates/{id}',
    tags: [tag],
    summary: 'Soft-delete a template. Requires `document:delete`.',
    security: openapi_util_1.bearerAuth,
    request: { params: TemplateIdParam },
    responses: { 200: okResponse('Template deleted') },
});
// ────────── Documents ──────────
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/documents',
    tags: [tag],
    summary: 'Upload a new document. Requires `document:write`.',
    security: openapi_util_1.bearerAuth,
    request: {
        body: {
            content: { 'multipart/form-data': { schema: MultipartUploadSchema } },
        },
    },
    responses: {
        201: okResponse('Document uploaded'),
        400: okResponse('Missing file or invalid metadata'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/{id}',
    tags: [tag],
    summary: 'Get document metadata + download URL. Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: { params: DocumentIdParam },
    responses: {
        200: okResponse('Document returned'),
        404: okResponse('Document not found'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/{id}/download',
    tags: [tag],
    summary: 'Get a download URL for a document. Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: { params: DocumentIdParam },
    responses: { 200: okResponse('Download URL returned') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'delete',
    path: '/documents/{id}',
    tags: [tag],
    summary: 'Soft-delete a document. Requires `document:delete`.',
    security: openapi_util_1.bearerAuth,
    request: { params: DocumentIdParam },
    responses: { 200: okResponse('Document deleted') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/by-entity/{entityType}/{entityId}',
    tags: [tag],
    summary: 'List documents attached to an entity. Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: { params: EntityParams },
    responses: { 200: okResponse('Document list returned') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/serve/{storedName}',
    tags: [tag],
    summary: 'Stream the raw file bytes for a document or historical version. Target of download URLs produced by LocalStorageClient. Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: {
        params: zod_1.z.object({
            storedName: zod_1.z
                .string()
                .openapi({ description: 'Storage key (UUID + extension)' }),
        }),
    },
    responses: {
        200: {
            description: 'File stream',
            content: {
                'application/octet-stream': {
                    schema: { type: 'string', format: 'binary' },
                },
            },
        },
        404: okResponse('File not found'),
    },
});
// ────────── Versioning ──────────
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/documents/{id}/versions',
    tags: [tag],
    summary: 'Upload a new version of a document. Requires `document:write`.',
    security: openapi_util_1.bearerAuth,
    request: {
        params: DocumentIdParam,
        body: {
            content: { 'multipart/form-data': { schema: MultipartVersionSchema } },
        },
    },
    responses: {
        201: okResponse('New version uploaded'),
        400: okResponse('Missing file'),
        404: okResponse('Document not found'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/{id}/versions',
    tags: [tag],
    summary: 'List all versions of a document (current + history). Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: { params: DocumentIdParam },
    responses: { 200: okResponse('Version list returned') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/{id}/versions/{version}',
    tags: [tag],
    summary: 'Get a specific version of a document. Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: { params: DocumentVersionParams },
    responses: {
        200: okResponse('Version returned'),
        404: okResponse('Document or version not found'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/documents/{id}/versions/{version}/download',
    tags: [tag],
    summary: 'Get a download URL for a specific version. Requires `document:read`.',
    security: openapi_util_1.bearerAuth,
    request: { params: DocumentVersionParams },
    responses: { 200: okResponse('Download URL returned') },
});
//# sourceMappingURL=document.docs.js.map