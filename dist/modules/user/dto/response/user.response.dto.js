"use strict";
// src/modules/user/dto/response/user.response.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapUserToResponse = exports.mapRoleToResponse = exports.mapPermissionToResponse = void 0;
const mapPermissionToResponse = (permission) => ({
    id: permission.id,
    slug: permission.slug,
    name: permission.name,
    module: permission.module,
    action: permission.action,
    description: permission.description,
});
exports.mapPermissionToResponse = mapPermissionToResponse;
const mapRoleToResponse = (role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.is_system,
    permissions: role.role_permissions.map((rp) => (0, exports.mapPermissionToResponse)(rp.permission)),
});
exports.mapRoleToResponse = mapRoleToResponse;
// Mapper: Prisma model → Response DTO
const mapUserToResponse = (user) => {
    const roles = user.user_roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
        permissions: ur.role.role_permissions.map((rp) => ({
            id: rp.permission.id,
            slug: rp.permission.slug,
            name: rp.permission.name,
            module: rp.permission.module,
            action: rp.permission.action,
        })),
    }));
    const permissions = [
        ...new Set(roles.flatMap((r) => r.permissions.map((p) => p.slug))),
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
        skills: parseSkills(user.skills),
        isActive: user.is_active,
        isSuperAdmin: user.is_super_admin,
        lastLoginAt: user.last_login_at?.toISOString() ?? null,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
        roles,
        permissions,
    };
};
exports.mapUserToResponse = mapUserToResponse;
function parseSkills(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((s) => typeof s === 'string' && s.length > 0)
            : [];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=user.response.dto.js.map