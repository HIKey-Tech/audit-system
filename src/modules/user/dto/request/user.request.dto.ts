// src/modules/user/dto/request/user.request.dto.ts
import { z } from 'zod';

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  displayName: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain uppercase, lowercase, number and special character',
    )
    .optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export const UpdateUserRequestSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

export const AssignRoleRequestSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1),
  expiresAt: z.string().datetime().optional(),
});

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain uppercase, lowercase, number and special character',
    ),
});

export const UserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  department: z.string().optional(),
  roleId: z.string().uuid().optional(),
  sortBy: z.enum(['email', 'first_name', 'created_at', 'last_login_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const RoleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'created_at']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateUserRequestDto = z.infer<typeof CreateUserRequestSchema>;
export type UpdateUserRequestDto = z.infer<typeof UpdateUserRequestSchema>;
export type AssignRoleRequestDto = z.infer<typeof AssignRoleRequestSchema>;
export type ChangePasswordRequestDto = z.infer<typeof ChangePasswordRequestSchema>;
export type UserQueryDto = z.infer<typeof UserQuerySchema>;
export type RoleQueryDto = z.infer<typeof RoleQuerySchema>;
