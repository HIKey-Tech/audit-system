"use strict";
// src/modules/user/docs/user.docs.ts
//
// OpenAPI registration for /users/* routes. Imported for side-effects
// from `modules/user/index.ts`.
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const openapi_util_1 = require("../../../shared/docs/openapi.util");
const user_request_dto_1 = require("../dto/request/user.request.dto");
const tag = 'Users';
const UserIdParam = zod_1.z.object({
    id: zod_1.z.string().uuid().openapi({ description: 'User UUID' }),
});
const UserAndRoleIdParams = zod_1.z.object({
    id: zod_1.z.string().uuid().openapi({ description: 'User UUID' }),
    roleId: zod_1.z.string().uuid().openapi({ description: 'Role UUID' }),
});
const okResponse = (description) => ({
    description,
    content: { 'application/json': { schema: openapi_util_1.ApiResponseSchema } },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/users/me',
    tags: [tag],
    summary: 'Get the authenticated user profile',
    security: openapi_util_1.bearerAuth,
    responses: { 200: okResponse('Profile returned') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'patch',
    path: '/users/me',
    tags: [tag],
    summary: 'Update the authenticated user profile',
    security: openapi_util_1.bearerAuth,
    request: {
        body: {
            content: { 'application/json': { schema: user_request_dto_1.UpdateUserRequestSchema } },
        },
    },
    responses: { 200: okResponse('Profile updated') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/users/me/change-password',
    tags: [tag],
    summary: 'Change the authenticated user password',
    security: openapi_util_1.bearerAuth,
    request: {
        body: {
            content: { 'application/json': { schema: user_request_dto_1.ChangePasswordRequestSchema } },
        },
    },
    responses: {
        200: okResponse('Password changed'),
        400: okResponse('Current password incorrect or SSO-only account'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/users',
    tags: [tag],
    summary: 'List users (paginated). Requires `user:read`.',
    security: openapi_util_1.bearerAuth,
    request: { query: user_request_dto_1.UserQuerySchema },
    responses: { 200: okResponse('Paginated user list') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/users/roles',
    tags: [tag],
    summary: 'List roles with permissions (paginated). Requires `user:read`.',
    security: openapi_util_1.bearerAuth,
    request: { query: user_request_dto_1.RoleQuerySchema },
    responses: { 200: okResponse('Paginated role list') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/users/permissions',
    tags: [tag],
    summary: 'List permissions. Requires `user:read`.',
    security: openapi_util_1.bearerAuth,
    responses: { 200: okResponse('Permission list') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/users',
    tags: [tag],
    summary: 'Create a user. Requires `user:write`.',
    security: openapi_util_1.bearerAuth,
    request: {
        body: {
            content: { 'application/json': { schema: user_request_dto_1.CreateUserRequestSchema } },
        },
    },
    responses: {
        201: okResponse('User created'),
        409: okResponse('Email already exists'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'get',
    path: '/users/{id}',
    tags: [tag],
    summary: 'Get user by ID. Requires `user:read`.',
    security: openapi_util_1.bearerAuth,
    request: { params: UserIdParam },
    responses: {
        200: okResponse('User returned'),
        404: okResponse('User not found'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'patch',
    path: '/users/{id}',
    tags: [tag],
    summary: 'Update user by ID. Requires `user:write`.',
    security: openapi_util_1.bearerAuth,
    request: {
        params: UserIdParam,
        body: {
            content: { 'application/json': { schema: user_request_dto_1.UpdateUserRequestSchema } },
        },
    },
    responses: { 200: okResponse('User updated') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/users/{id}/deactivate',
    tags: [tag],
    summary: 'Deactivate user. Requires super_admin and `user:deactivate`.',
    security: openapi_util_1.bearerAuth,
    request: { params: UserIdParam },
    responses: { 200: okResponse('User deactivated') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'post',
    path: '/users/{id}/activate',
    tags: [tag],
    summary: 'Activate user. Requires super_admin and `user:deactivate`.',
    security: openapi_util_1.bearerAuth,
    request: { params: UserIdParam },
    responses: { 200: okResponse('User activated') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'delete',
    path: '/users/{id}',
    tags: [tag],
    summary: 'Soft-delete user. Requires super_admin and `user:delete`.',
    security: openapi_util_1.bearerAuth,
    request: { params: UserIdParam },
    responses: { 200: okResponse('User soft-deleted') },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'put',
    path: '/users/{id}/roles',
    tags: [tag],
    summary: 'Assign roles to user. Requires `user:admin`.',
    security: openapi_util_1.bearerAuth,
    request: {
        params: UserIdParam,
        body: {
            content: { 'application/json': { schema: user_request_dto_1.AssignRoleRequestSchema } },
        },
    },
    responses: {
        200: okResponse('Roles assigned'),
        400: okResponse('One or more role IDs invalid'),
    },
});
openapi_util_1.openApiRegistry.registerPath({
    method: 'delete',
    path: '/users/{id}/roles/{roleId}',
    tags: [tag],
    summary: 'Remove a role from a user. Requires `user:admin`.',
    security: openapi_util_1.bearerAuth,
    request: { params: UserAndRoleIdParams },
    responses: { 200: okResponse('Role removed') },
});
//# sourceMappingURL=user.docs.js.map