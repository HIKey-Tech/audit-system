"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAuditLogger = void 0;
const audit_log_service_1 = require("../service/implementation/audit-log.service");
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
/**
 * Express middleware that automatically logs mutating requests (POST/PUT/PATCH/DELETE)
 * to the audit log after the response is sent.
 */
const requestAuditLogger = (req, res, next) => {
    const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!MUTATING.includes(req.method)) {
        return next();
    }
    const startAt = Date.now();
    res.on('finish', () => {
        const durationMs = Date.now() - startAt;
        const requestPath = getRequestPath(req);
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
    next();
};
exports.requestAuditLogger = requestAuditLogger;
//# sourceMappingURL=request-logger.middleware.js.map