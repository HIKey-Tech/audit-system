"use strict";
// src/modules/user/dto/response/user.response.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapUserToResponse = void 0;
// Mapper: Prisma model → Response DTO
const mapUserToResponse = (user) => {
    const roles = user.user_roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
        permissions: ur.role.role_permissions.map((rp) => ({
            id: rp.permission.id,
            name: rp.permission.name,
            module: rp.permission.module,
            action: rp.permission.action,
        })),
    }));
    const permissions = [
        ...new Set(roles.flatMap((r) => r.permissions.map((p) => p.name))),
    ];
    return {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        department: user.department,
        jobTitle: user.job_title,
        isActive: user.is_active,
        lastLoginAt: user.last_login_at?.toISOString() ?? null,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
        roles,
        permissions,
    };
};
exports.mapUserToResponse = mapUserToResponse;
//# sourceMappingURL=user.response.dto.js.map