// src/shared/docs/openapi.util.ts
//
// OpenAPI 3.0 spec builder for IAMS.
// Each module registers its routes against the shared `openApiRegistry`.
// `buildOpenApiDocument()` is called once at server boot to compile the spec.

import { z } from 'zod';
import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { config } from '../config/app.config';

// Mutates Zod's prototype so `.openapi(...)` chaining is available everywhere.
extendZodWithOpenApi(z);

export const openApiRegistry = new OpenAPIRegistry();

const BEARER_AUTH_SCHEME = 'BearerAuth';

openApiRegistry.registerComponent('securitySchemes', BEARER_AUTH_SCHEME, {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT access token issued by `/auth/login` or `/auth/callback`.',
});

export const bearerAuth = [{ [BEARER_AUTH_SCHEME]: [] as string[] }];

/**
 * Generic envelope used by every IAMS response.
 * Mirrors `ApiResponse<T>` in `shared/types/api-response.type.ts`.
 */
export const ApiResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    data: z.unknown().optional(),
    errors: z.unknown().optional(),
    meta: z
      .object({
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
        totalPages: z.number(),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      })
      .optional(),
    timestamp: z.string(),
    requestId: z.string().optional(),
  })
  .openapi('ApiResponse');

openApiRegistry.register('ApiResponse', ApiResponseSchema);

export const buildOpenApiDocument = (): ReturnType<OpenApiGeneratorV3['generateDocument']> => {
  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: `${config.app.name} API`,
      version: '1.0.0',
      description:
        'Internal Audit Management Software (IAMS) — backend API for Galaxy Backbone Limited.',
    },
    servers: [
      {
        url: `${config.app.url}/api/${config.app.apiVersion}`,
        description: `${config.app.env} environment`,
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication, SSO, refresh tokens' },
      { name: 'Users', description: 'User CRUD, profile, role assignment' },
    ],
  });
};
