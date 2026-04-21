// src/modules/user/docs/auth.docs.ts
//
// OpenAPI registration for /auth/* routes. Imported for side-effects
// from `modules/user/index.ts`.

import {
  ApiResponseSchema,
  bearerAuth,
  openApiRegistry,
} from '../../../shared/docs/openapi.util';
import {
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  OidcCallbackRequestSchema,
} from '../dto/request/auth.request.dto';

const tag = 'Auth';

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: [tag],
  summary: 'Authenticate with email + password',
  request: {
    body: {
      content: { 'application/json': { schema: LoginRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login successful — returns access + refresh tokens',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
    401: {
      description: 'Invalid credentials',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/auth/sso',
  tags: [tag],
  summary: 'Initiate SSO — returns the IdP authorization URL',
  responses: {
    200: {
      description: 'Authorization URL generated',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/auth/callback',
  tags: [tag],
  summary: 'OIDC callback — exchanges authorization code for tokens',
  request: {
    query: OidcCallbackRequestSchema,
  },
  responses: {
    200: {
      description: 'SSO authentication successful',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
    401: {
      description: 'OIDC code exchange failed',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: [tag],
  summary: 'Rotate refresh token and issue a new access token',
  request: {
    body: {
      content: { 'application/json': { schema: RefreshTokenRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Token rotated successfully',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
    401: {
      description: 'Refresh token invalid, expired, or already used',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: [tag],
  summary: 'Revoke a single refresh token',
  security: bearerAuth,
  request: {
    body: {
      content: { 'application/json': { schema: RefreshTokenRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Logged out',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/logout-all',
  tags: [tag],
  summary: 'Revoke all refresh tokens for the authenticated user',
  security: bearerAuth,
  responses: {
    200: {
      description: 'All sessions terminated',
      content: { 'application/json': { schema: ApiResponseSchema } },
    },
  },
});
