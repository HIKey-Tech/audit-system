"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapUserToResponse = exports.mapRoleToResponse = exports.mapPermissionToResponse = exports.mapUserToDirectory = exports.mapUserToAccessEntitlement = void 0;
const mapUserToAccessEntitlement = (user, now = new Date()) => {
    const liveRoles = user.user_roles.filter((ur) => !ur.expires_at || ur.expires_at > now);
    const permissions = new Set();
    for (const ur of liveRoles) {
        for (const rp of ur.role.role_permissions)
            permissions.add(rp.permission.slug);
    }
    return {
        id: user.id,
        email: user.email,
        displayName: user.display_name ?? `${user.first_name} ${user.last_name}`.trim(),
        department: user.department,
        jobTitle: user.job_title,
        isActive: user.is_active,
        isSuperAdmin: user.is_super_admin,
        mfaEnabled: user.mfa_enabled,
        lastLoginAt: user.last_login_at?.toISOString() ?? null,
        createdAt: user.created_at.toISOString(),
        roles: liveRoles.map((ur) => ur.role.name),
        roleSources: Object.fromEntries(liveRoles.map((ur) => [ur.role.name, ur.source])),
        permissions: Array.from(permissions).sort(),
    };
};
exports.mapUserToAccessEntitlement = mapUserToAccessEntitlement;
const mapUserToDirectory = (u) => ({
    id: u.id,
    displayName: u.display_name,
    firstName: u.first_name,
    lastName: u.last_name,
    department: u.department,
    jobTitle: u.job_title,
    isActive: u.is_active,
});
exports.mapUserToDirectory = mapUserToDirectory;
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
        maxConcurrentEngagements: user.max_concurrent_engagements,
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