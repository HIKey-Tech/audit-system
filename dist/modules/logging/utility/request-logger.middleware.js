"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAuditLogger = void 0;
const audit_log_service_1 = require("../service/implementation/audit-log.service");
const logging_enum_1 = require("../domain/enum/logging.enum");
const security_event_utility_1 = require("./security-event.utility");
const request_context_util_1 = require("../../../shared/utils/request-context.util");
/**
 * Authentication endpoints already write a dedicated security event
 * (`auth.login.succeeded`, `auth.logout`, …) with the real user attached, so the
 * generic request row would only add an anonymous "System" duplicate.
 */
const SECURITY_EVENT_PATHS = /\/auth\/(login|logout|refresh)\/?$/;
const MODULE_ALIASES = {
    users: 'user',
    documents: 'document',
    notifications: 'messaging',
    jobs: 'background',
    logs: 'logging',
};
const getRequestPath = (req) => {
    const [path] = req.originalUrl.split('?');
    return path || req.path;
};
const getModuleFromPath = (path) => {
    const segments = path.split('/').filter(Boolean);
    const routeModule = segments[0] === 'api' ? segments[2] : segments[0];
    if (!routeModule) {
        return 'unknown';
    }
    return MODULE_ALIASES[routeModule] ?? routeModule;
};
const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];
/**
 * Express middleware that automatically logs mutating requests (POST/PUT/PATCH/DELETE)
 * to the audit log after the response is sent. Any request refused with 403 —
 * reads included — is additionally recorded as an `access.denied` security event.
 */
const requestAuditLogger = (req, res, next) => {
    const isMutating = MUTATING.includes(req.method);
    const startAt = Date.now();
    res.on('finish', () => {
        const requestPath = getRequestPath(req);
        if (res.statusCode === 403) {
            (0, security_event_utility_1.logSecurityEvent)(logging_enum_1.SecurityEvent.AccessDenied, {
                userId: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                httpMethod: req.method,
                path: requestPath,
                status: 'failure',
            });
        }
        if (!isMutating)
            return;
        if (SECURITY_EVENT_PATHS.test(requestPath))
            return;
        const durationMs = Date.now() - startAt;
        const module = getModuleFromPath(requestPath);
        audit_log_service_1.auditLogService.logAsync({
            userId: req.user?.id,
            action: `${req.method}:${requestPath}`,
            module,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            status: res.statusCode < 400 ? 'success' : 'failure',
            durationMs,
        });
    });
    (0, request_context_util_1.runWithRequestContext)({ ipAddress: req.ip, userAgent: req.headers['user-agent'] }, () => next());
};
exports.requestAuditLogger = requestAuditLogger;
//# sourceMappingURL=request-logger.middleware.js.map