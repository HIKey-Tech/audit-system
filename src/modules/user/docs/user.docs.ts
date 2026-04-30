// src/modules/user/docs/user.docs.ts
//
// OpenAPI registration for /users/* routes. Imported for side-effects
// from `modules/user/index.ts`.

import { z } from 'zod';
import {
  ApiResponseSchema,
  bearerAuth,
  openApiRegistry,
} from '../../../shared/docs/openapi.util';
import {
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  AssignRoleRequestSchema,
  ChangePasswordRequestSchema,
  UserQuerySchema,
  RoleQuerySchema,
} from '../dto/request/user.request.dto';

const tag = 'Users';

const UserIdParam = z.object({
  id: z.string().uuid().openapi({ description: 'User UUID' }),
});

const UserAndRoleIdParams = z.object({
  id: z.string().uuid().openapi({ description: 'User UUID' }),
  roleId: z.string().uuid().openapi({ description: 'Role UUID' }),
});

const okResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ApiResponseSchema } },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/users/me',
  tags: [tag],
  summary: 'Get the authenticated user profile',
  security: bearerAuth,
  responses: { 200: okResponse('Profile returned') },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/users/me',
  tags: [tag],
  summary: 'Update the authenticated user profile',
  security: bearerAuth,
  request: {
    body: {
      content: { 'application/json': { schema: UpdateUserRequestSchema } },
    },
  },
  responses: { 200: okResponse('Profile updated') },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/users/me/change-password',
  tags: [tag],
  summary: 'Change the authenticated user password',
  security: bearerAuth,
  request: {
    body: {
      content: { 'application/json': { schema: ChangePasswordRequestSchema } },
    },
  },
  responses: {
    200: okResponse('Password changed'),
    400: okResponse('Current password incorrect or SSO-only account'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/users',
  tags: [tag],
  summary: 'List users (paginated). Requires `user:read`.',
  security: bearerAuth,
  request: { query: UserQuerySchema },
  responses: { 200: okResponse('Paginated user list') },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/users/roles',
  tags: [tag],
  summary: 'List roles with permissions (paginated). Requires `user:read`.',
  security: bearerAuth,
  request: { query: RoleQuerySchema },
  responses: { 200: okResponse('Paginated role list') },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/users/permissions',
  tags: [tag],
  summary: 'List permissions. Requires `user:read`.',
  security: bearerAuth,
  responses: { 200: okResponse('Permission list') },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/users',
  tags: [tag],
  summary: 'Create a user. Requires `user:write`.',
  security: bearerAuth,
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserRequestSchema } },
    },
  },
  responses: {
    201: okResponse('User created'),
    409: okResponse('Email already exists'),
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/users/{id}',
  tags: [tag],
  summary: 'Get user by ID. Requires `user:read`.',
  security: bearerAuth,
  request: { params: UserIdParam },
  responses: {
    200: okResponse('User returned'),
    404: okResponse('User not found'),
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/users/{id}',
  tags: [tag],
  summary: 'Update user by ID. Requires `user:write`.',
  security: bearerAuth,
  request: {
    params: UserIdParam,
    body: {
      content: { 'application/json': { schema: UpdateUserRequestSchema } },
    },
  },
  responses: { 200: okResponse('User updated') },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  tags: [tag],
  summary: 'Soft-delete user. Requires `user:delete`.',
  security: bearerAuth,
  request: { params: UserIdParam },
  responses: { 200: okResponse('User soft-deleted') },
});

openApiRegistry.registerPath({
  method: 'put',
  path: '/users/{id}/roles',
  tags: [tag],
  summary: 'Assign roles to user. Requires `user:admin`.',
  security: bearerAuth,
  request: {
    params: UserIdParam,
    body: {
      content: { 'application/json': { schema: AssignRoleRequestSchema } },
    },
  },
  responses: {
    200: okResponse('Roles assigned'),
    400: okResponse('One or more role IDs invalid'),
  },
});

openApiRegistry.registerPath({
  method: 'delete',
  path: '/users/{id}/roles/{roleId}',
  tags: [tag],
  summary: 'Remove a role from a user. Requires `user:admin`.',
  security: bearerAuth,
  request: { params: UserAndRoleIdParams },
  responses: { 200: okResponse('Role removed') },
});
