// src/modules/document/docs/document.docs.ts
//
// OpenAPI registration for /documents/* routes. Imported for side-effects
// from `modules/document/index.ts`.

import { z } from 'zod';
import {
  ApiResponseSchema,
  bearerAuth,
  openApiRegistry,
} from '../../../shared/docs/openapi.util';
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  TemplateQuerySchema,
} from '../dto/request/document.request.dto';

const tag = 'Documents';

const DocumentIdParam = z.object({
  id: z.string().uuid().openapi({ description: 'Document UUID' }),
});

const DocumentVersionParams = z.object({
  id: z.string().uuid().openapi({ description: 'Document UUID' }),
  version: z.coerce.number().int().positive().openapi({ description: 'Version number' }),
});

const EntityParams = z.object({
  entityType: z.string().openapi({ description: 'Entity type (e.g. audit_engagement)' }),
  entityId: z.string().uuid().openapi({ description: 'Entity UUID' }),
});

const TemplateIdParam = z.object({
  id: z.string().uuid().openapi({ description: 'Template UUID' }),
});

const MultipartUploadSchema = z
  .object({
    file: z.any().openapi({ type: 'string', format: 'binary' }),
    module: z.string().openapi({ description: 'Owning module (e.g. audit, finding)' }),
    entityType: z.string().optional(),
    entityId: z.string().uuid().optional(),
  })
  .openapi('DocumentUpload');

const MultipartVersionSchema = z
  .object({
    file: z.any().openapi({ type: 'string', format: 'binary' }),
    changeNote: z.string().optional(),
  })
  .openapi('DocumentVersionUpload');

const okResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ApiResponseSchema } },
});

// ────────── Templates ──────────

openApiRegistry.registerPath({
  method: 'post',
  path: '/documents/templates',
  tags: [tag],
  summary: 'Create a document template. Requires `document:write`.',
  security: bearerAuth,
  request: {
    body: {
      content: { 'application/json': { schema: CreateTemplateRequestSchema } },
    },
  },
  responses: {
    201: okResponse('Template created'),
    409: okResponse('Template name already exists'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/templates',
  tags: [tag],
  summary: 'List templates (paginated). Requires `document:read`.',
  security: bearerAuth,
  request: { query: TemplateQuerySchema },
  responses: { 200: okResponse('Paginated template list') },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/templates/{id}',
  tags: [tag],
  summary: 'Get a template by ID. Requires `document:read`.',
  security: bearerAuth,
  request: { params: TemplateIdParam },
  responses: {
    200: okResponse('Template returned'),
    404: okResponse('Template not found'),
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/documents/templates/{id}',
  tags: [tag],
  summary: 'Update a template. Requires `document:write`.',
  security: bearerAuth,
  request: {
    params: TemplateIdParam,
    body: {
      content: { 'application/json': { schema: UpdateTemplateRequestSchema } },
    },
  },
  responses: { 200: okResponse('Template updated') },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/documents/templates/{id}',
  tags: [tag],
  summary: 'Soft-delete a template. Requires `document:delete`.',
  security: bearerAuth,
  request: { params: TemplateIdParam },
  responses: { 200: okResponse('Template deleted') },
});

// ────────── Documents ──────────

openApiRegistry.registerPath({
  method: 'post',
  path: '/documents',
  tags: [tag],
  summary: 'Upload a new document. Requires `document:write`.',
  security: bearerAuth,
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

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/{id}',
  tags: [tag],
  summary: 'Get document metadata + download URL. Requires `document:read`.',
  security: bearerAuth,
  request: { params: DocumentIdParam },
  responses: {
    200: okResponse('Document returned'),
    404: okResponse('Document not found'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/{id}/download',
  tags: [tag],
  summary: 'Get a download URL for a document. Requires `document:read`.',
  security: bearerAuth,
  request: { params: DocumentIdParam },
  responses: { 200: okResponse('Download URL returned') },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/documents/{id}',
  tags: [tag],
  summary: 'Soft-delete a document. Requires `document:delete`.',
  security: bearerAuth,
  request: { params: DocumentIdParam },
  responses: { 200: okResponse('Document deleted') },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/by-entity/{entityType}/{entityId}',
  tags: [tag],
  summary: 'List documents attached to an entity. Requires `document:read`.',
  security: bearerAuth,
  request: { params: EntityParams },
  responses: { 200: okResponse('Document list returned') },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/serve/{storedName}',
  tags: [tag],
  summary:
    'Stream the raw file bytes for a document or historical version. Target of download URLs produced by LocalStorageClient. Requires `document:read`.',
  security: bearerAuth,
  request: {
    params: z.object({
      storedName: z
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

openApiRegistry.registerPath({
  method: 'post',
  path: '/documents/{id}/versions',
  tags: [tag],
  summary: 'Upload a new version of a document. Requires `document:write`.',
  security: bearerAuth,
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

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/{id}/versions',
  tags: [tag],
  summary: 'List all versions of a document (current + history). Requires `document:read`.',
  security: bearerAuth,
  request: { params: DocumentIdParam },
  responses: { 200: okResponse('Version list returned') },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/{id}/versions/{version}',
  tags: [tag],
  summary: 'Get a specific version of a document. Requires `document:read`.',
  security: bearerAuth,
  request: { params: DocumentVersionParams },
  responses: {
    200: okResponse('Version returned'),
    404: okResponse('Document or version not found'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/documents/{id}/versions/{version}/download',
  tags: [tag],
  summary: 'Get a download URL for a specific version. Requires `document:read`.',
  security: bearerAuth,
  request: { params: DocumentVersionParams },
  responses: { 200: okResponse('Download URL returned') },
});
