"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserQuerySchema = exports.ChangePasswordRequestSchema = exports.AssignRoleRequestSchema = exports.UpdateUserRequestSchema = exports.CreateUserRequestSchema = void 0;
// src/modules/user/dto/request/user.request.dto.ts
const zod_1 = require("zod");
exports.CreateUserRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().min(1).max(100),
    displayName: zod_1.z.string().max(200).optional(),
    phone: zod_1.z.string().max(20).optional(),
    department: zod_1.z.string().max(100).optional(),
    jobTitle: zod_1.z.string().max(100).optional(),
    password: zod_1.z
        .string()
        .min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Password must contain uppercase, lowercase, number and special character')
        .optional(),
    roleIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.UpdateUserRequestSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(100).optional(),
    lastName: zod_1.z.string().min(1).max(100).optional(),
    displayName: zod_1.z.string().max(200).optional(),
    phone: zod_1.z.string().max(20).optional(),
    department: zod_1.z.string().max(100).optional(),
    jobTitle: zod_1.z.string().max(100).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.AssignRoleRequestSchema = zod_1.z.object({
    roleIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    expiresAt: zod_1.z.string().datetime().optional(),
});
exports.ChangePasswordRequestSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z
        .string()
        .min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Password must contain uppercase, lowercase, number and special character'),
});
exports.UserQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    search: zod_1.z.string().optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
    department: zod_1.z.string().optional(),
    roleId: zod_1.z.string().uuid().optional(),
    sortBy: zod_1.z.enum(['email', 'first_name', 'created_at', 'last_login_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=user.request.dto.js.map