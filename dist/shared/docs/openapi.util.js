"use strict";
// src/shared/docs/openapi.util.ts
//
// OpenAPI 3.0 spec builder for IAMS.
// Each module registers its routes against the shared `openApiRegistry`.
// `buildOpenApiDocument()` is called once at server boot to compile the spec.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOpenApiDocument = exports.ApiResponseSchema = exports.bearerAuth = exports.openApiRegistry = void 0;
const zod_1 = require("zod");
const zod_to_openapi_1 = require("@asteasolutions/zod-to-openapi");
const app_config_1 = require("../config/app.config");
// Mutates Zod's prototype so `.openapi(...)` chaining is available everywhere.
(0, zod_to_openapi_1.extendZodWithOpenApi)(zod_1.z);
exports.openApiRegistry = new zod_to_openapi_1.OpenAPIRegistry();
const BEARER_AUTH_SCHEME = 'BearerAuth';
exports.openApiRegistry.registerComponent('securitySchemes', BEARER_AUTH_SCHEME, {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT access token issued by `/auth/login` or `/auth/callback`.',
});
exports.bearerAuth = [{ [BEARER_AUTH_SCHEME]: [] }];
/**
 * Generic envelope used by every IAMS response.
 * Mirrors `ApiResponse<T>` in `shared/types/api-response.type.ts`.
 */
exports.ApiResponseSchema = zod_1.z
    .object({
    success: zod_1.z.boolean(),
    message: zod_1.z.string(),
    data: zod_1.z.unknown().optional(),
    errors: zod_1.z.unknown().optional(),
    meta: zod_1.z
        .object({
        page: zod_1.z.number(),
        pageSize: zod_1.z.number(),
        total: zod_1.z.number(),
        totalPages: zod_1.z.number(),
        hasNext: zod_1.z.boolean(),
        hasPrev: zod_1.z.boolean(),
    })
        .optional(),
    timestamp: zod_1.z.string(),
    requestId: zod_1.z.string().optional(),
})
    .openapi('ApiResponse');
exports.openApiRegistry.register('ApiResponse', exports.ApiResponseSchema);
const buildOpenApiDocument = () => {
    const generator = new zod_to_openapi_1.OpenApiGeneratorV3(exports.openApiRegistry.definitions);
    return generator.generateDocument({
        openapi: '3.0.3',
        info: {
            title: `${app_config_1.config.app.name} API`,
            version: '1.0.0',
            description: 'Internal Audit Management Software (IAMS) — backend API for Galaxy Backbone Limited.',
        },
        servers: [
            {
                url: `${app_config_1.config.app.url}/api/${app_config_1.config.app.apiVersion}`,
                description: `${app_config_1.config.app.env} environment`,
            },
        ],
        tags: [
            { name: 'Auth', description: 'Authentication, SSO, refresh tokens' },
            { name: 'Users', description: 'User CRUD, profile, role assignment' },
            { name: 'Documents', description: 'Document upload, versioning, templates, file serving' },
        ],
    });
};
exports.buildOpenApiDocument = buildOpenApiDocument;
//# sourceMappingURL=openapi.util.js.map