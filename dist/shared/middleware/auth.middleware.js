"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requirePermission = exports.requireEnrollmentContext = exports.requireMfaToken = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_config_1 = require("../config/app.config");
const app_error_1 = require("../errors/app.error");
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
        // Scoped tokens (mfa_enroll / mfa_challenge) are not full access tokens.
        if (payload.scope) {
            throw app_error_1.AppError.unauthorized('Invalid token');
        }
        req.user = {
            id: payload.sub,
            email: payload.email,
            displayName: payload.displayName,
            roles: payload.roles ?? [],
            permissions: payload.permissions ?? [],
            isSuperAdmin: payload.isSuperAdmin ?? false,
        };
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.authenticate = authenticate;
/**
 * Guards the intermediate MFA endpoints. Accepts only a short-lived token
 * carrying the matching `scope` claim (issued during the login flow), and
 * attaches the subject to `req.mfaToken`.
 */
const requireMfaToken = (scope) => (req, _res, next) => {
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
        if (payload.scope !== scope) {
            throw app_error_1.AppError.unauthorized('Invalid token');
        }
        req.mfaToken = { id: payload.sub, email: payload.email };
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.requireMfaToken = requireMfaToken;
/**
 * Enrolment context: accepts EITHER a short-lived `mfa_enroll` token (forced
 * enrolment during login) OR a normal access token (a logged-in user choosing
 * to set up 2FA voluntarily during the grace period). Attaches `req.mfaToken`.
 */
const requireEnrollmentContext = (req, _res, next) => {
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
        // Allow only an access token (no scope) or the enrolment-scoped token.
        if (payload.scope && payload.scope !== 'mfa_enroll') {
            throw app_error_1.AppError.unauthorized('Invalid token');
        }
        req.mfaToken = { id: payload.sub, email: payload.email };
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.requireEnrollmentContext = requireEnrollmentContext;
const requirePermission = (...requiredPermissions) => (req, _res, next) => {
    if (!req.user) {
        return next(app_error_1.AppError.unauthorized());
    }
    if (req.user.isSuperAdmin) {
        return next();
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