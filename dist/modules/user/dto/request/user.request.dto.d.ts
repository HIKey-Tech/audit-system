import { z } from 'zod';
export declare const CreateUserRequestSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    jobTitle: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    roleIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | undefined;
    department?: string | undefined;
    password?: string | undefined;
    displayName?: string | undefined;
    jobTitle?: string | undefined;
    roleIds?: string[] | undefined;
}, {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | undefined;
    department?: string | undefined;
    password?: string | undefined;
    displayName?: string | undefined;
    jobTitle?: string | undefined;
    roleIds?: string[] | undefined;
}>;
export declare const UpdateUserRequestSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    displayName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    jobTitle: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    phone?: string | undefined;
    department?: string | undefined;
    displayName?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    jobTitle?: string | undefined;
    isActive?: boolean | undefined;
}, {
    phone?: string | undefined;
    department?: string | undefined;
    displayName?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    jobTitle?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const AssignRoleRequestSchema: z.ZodObject<{
    roleIds: z.ZodArray<z.ZodString, "many">;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roleIds: string[];
    expiresAt?: string | undefined;
}, {
    roleIds: string[];
    expiresAt?: string | undefined;
}>;
export declare const ChangePasswordRequestSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export declare const UserQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    department: z.ZodOptional<z.ZodString>;
    roleId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["email", "first_name", "created_at", "last_login_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "email" | "first_name" | "last_login_at" | "created_at";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    department?: string | undefined;
    isActive?: boolean | undefined;
    roleId?: string | undefined;
}, {
    search?: string | undefined;
    department?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "email" | "first_name" | "last_login_at" | "created_at" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    isActive?: boolean | undefined;
    roleId?: string | undefined;
}>;
export declare const RoleQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["name", "created_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "name" | "created_at";
    sortOrder: "asc" | "desc";
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "name" | "created_at" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const CreateRoleRequestSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    permissionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    permissionIds?: string[] | undefined;
}, {
    name: string;
    description?: string | undefined;
    permissionIds?: string[] | undefined;
}>;
export declare const UpdateRoleRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
}>;
export declare const ReplaceRolePermissionsRequestSchema: z.ZodObject<{
    permissionIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    permissionIds: string[];
}, {
    permissionIds: string[];
}>;
export type CreateUserRequestDto = z.infer<typeof CreateUserRequestSchema>;
export type UpdateUserRequestDto = z.infer<typeof UpdateUserRequestSchema>;
export type AssignRoleRequestDto = z.infer<typeof AssignRoleRequestSchema>;
export type ChangePasswordRequestDto = z.infer<typeof ChangePasswordRequestSchema>;
export type UserQueryDto = z.infer<typeof UserQuerySchema>;
export type RoleQueryDto = z.infer<typeof RoleQuerySchema>;
export type CreateRoleRequestDto = z.infer<typeof CreateRoleRequestSchema>;
export type UpdateRoleRequestDto = z.infer<typeof UpdateRoleRequestSchema>;
export type ReplaceRolePermissionsRequestDto = z.infer<typeof ReplaceRolePermissionsRequestSchema>;
//# sourceMappingURL=user.request.dto.d.ts.map