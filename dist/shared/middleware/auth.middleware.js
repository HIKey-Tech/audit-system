"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requirePermission = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_config_1 = require("../config/app.config");
const app_error_1 = require("../errors/app.error");
const prisma_client_1 = require("../prisma/prisma.client");
const prisma_types_1 = require("../prisma/prisma.types");
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw app_error_1.AppError.unauthorized('Missing or invalid authorization header');
        }
        const token = authHeader.slice(7);
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(token, app_config_1.config.jwt.secret);
        }
        catch (err) {
            if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new app_error_1.AppError('Token expired', 401, 'TOKEN_EXPIRED');
            }
            throw app_error_1.AppError.unauthorized('Invalid token');
        }
        const user = await prisma_client_1.prisma.user.findFirst({
            where: { id: payload.sub, is_active: true, deleted_at: null },
            include: prisma_types_1.userWithRolesInclude,
        });
        if (!user) {
            throw app_error_1.AppError.unauthorized('User not found or inactive');
        }
        const now = new Date();
        const activeUserRoles = user.user_roles.filter((ur) => ur.expires_at === null || ur.expires_at > now);
        const roles = activeUserRoles.map((ur) => ur.role.name);
        const permissions = [
            ...new Set(activeUserRoles.flatMap((ur) => ur.role.role_permissions.map((rp) => rp.permission.name))),
        ];
        req.user = {
            id: user.id,
            email: user.email,
            displayName: user.display_name ?? `${user.first_name} ${user.last_name}`,
            roles,
            permissions,
        };
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.authenticate = authenticate;
const requirePermission = (...requiredPermissions) => (req, _res, next) => {
    if (!req.user) {
        return next(app_error_1.AppError.unauthorized());
    }
    const hasAll = requiredPermissions.every((perm) => req.user.permissions.includes(perm));
    if (!hasAll) {
        return next(app_error_1.AppError.forbidden('Insufficient permissions'));
    }
    next();
};
exports.requirePermission = requirePermission;
const requireRole = (...requiredRoles) => (req, _res, next) => {
    if (!req.user) {
        return next(app_error_1.AppError.unauthorized());
    }
    const hasRole = requiredRoles.some((role) => req.user.roles.includes(role));
    if (!hasRole) {
        return next(app_error_1.AppError.forbidden('Insufficient role'));
    }
    next();
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.middleware.js.map