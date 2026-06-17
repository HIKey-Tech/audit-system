"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplaceRolePermissionsRequestSchema = exports.UpdateRoleRequestSchema = exports.CreateRoleRequestSchema = exports.RoleQuerySchema = exports.UserQuerySchema = exports.ChangePasswordRequestSchema = exports.AssignRoleRequestSchema = exports.UpdateUserRequestSchema = exports.CreateUserRequestSchema = void 0;
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
    skills: zod_1.z.array(zod_1.z.string().trim().min(1, 'Skill tag must not be empty').max(100)).max(30, 'Maximum 30 skill tags').optional(),
    maxConcurrentEngagements: zod_1.z.number().int().positive().max(50).optional(),
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
    skills: zod_1.z.array(zod_1.z.string().trim().min(1, 'Skill tag must not be empty').max(100)).max(30, 'Maximum 30 skill tags').optional(),
    maxConcurrentEngagements: zod_1.z.number().int().positive().max(50).nullable().optional(),
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
exports.RoleQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.enum(['name', 'created_at']).default('name'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
exports.CreateRoleRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
    permissionIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.UpdateRoleRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().max(500).nullable().optional(),
});
exports.ReplaceRolePermissionsRequestSchema = zod_1.z.object({
    permissionIds: zod_1.z.array(zod_1.z.string().uuid()),
});
//# sourceMappingURL=user.request.dto.js.map