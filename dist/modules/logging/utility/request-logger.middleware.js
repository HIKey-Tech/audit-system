"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAuditLogger = void 0;
const audit_log_service_1 = require("../service/implementation/audit-log.service");
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
        // Path is shaped /api/<version>/<module>/... — segment[2] is the module.
        const segments = req.path.split('/').filter(Boolean);
        const module = segments[2] ?? segments[0] ?? 'unknown';
        audit_log_service_1.auditLogService.logAsync({
            userId: req.user?.id,
            action: `${req.method}:${req.path}`,
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