"use strict";
// src/modules/user/docs/auth.docs.ts
//
// OpenAPI registration for /auth/* routes. Imported for side-effects
// from `modules/user/index.ts`.
Object.defineProperty(exports, "__esModule", { value: true });
const openapi_util_1 = require("../../../shared/docs/openapi.util");
const auth_request_dto_1 = require("../dto/request/auth.request.dto");
const tag = 'Auth';
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: [tag],
    summary: 'Authenticate with email + password',
    request: {
        body: {
            content: { 'application/json': { schema: auth_request_dto_1.LoginRequestSchema } },
        },
    },
    responses: {
        200: {
            description: 'Login successful — returns access + refresh tokens',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
        401: {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/auth/sso',
    tags: [tag],
    summary: 'Initiate SSO — returns the IdP authorization URL',
    responses: {
        200: {
            description: 'Authorization URL generated',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/auth/callback',
    tags: [tag],
    summary: 'OIDC callback — exchanges authorization code for tokens',
    request: {
        query: auth_request_dto_1.OidcCallbackRequestSchema,
    },
    responses: {
        200: {
            description: 'SSO authentication successful',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
        401: {
            description: 'OIDC code exchange failed',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: [tag],
    summary: 'Rotate refresh token and issue a new access token',
    request: {
        body: {
            content: { 'application/json': { schema: auth_request_dto_1.RefreshTokenRequestSchema } },
        },
    },
    responses: {
        200: {
            description: 'Token rotated successfully',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
        401: {
            description: 'Refresh token invalid, expired, or already used',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: [tag],
    summary: 'Revoke a single refresh token',
    security: openapi_util_1.bearerAuth,
    request: {
        body: {
            content: { 'application/json': { schema: auth_request_dto_1.RefreshTokenRequestSchema } },
        },
    },
    responses: {
        200: {
            description: 'Logged out',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/auth/logout-all',
    tags: [tag],
    summary: 'Revoke all refresh tokens for the authenticated user',
    security: openapi_util_1.bearerAuth,
    responses: {
        200: {
            description: 'All sessions terminated',
            content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
        },
    },
});
//# sourceMappingURL=auth.docs.js.map