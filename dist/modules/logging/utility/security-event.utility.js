"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSecurityEvent = void 0;
const audit_log_service_1 = require("../service/implementation/audit-log.service");
const logging_enum_1 = require("../domain/enum/logging.enum");
/**
 * Records one security event in the tamper-evident audit trail. Fire-and-forget
 * and never throws — a monitoring write must never block a sign-in.
 */
const logSecurityEvent = (event, details = {}) => {
    const { userId, ipAddress, userAgent, status, ...rest } = details;
    const values = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    audit_log_service_1.auditLogService.logAsync({
        userId: userId ?? undefined,
        action: event,
        module: logging_enum_1.SECURITY_LOG_MODULE,
        entityType: userId ? 'user' : undefined,
        entityId: userId ?? undefined,
        newValues: Object.keys(values).length > 0 ? values : undefined,
        ipAddress,
        userAgent,
        status: status ?? 'success',
    });
};
exports.logSecurityEvent = logSecurityEvent;
//# sourceMappingURL=security-event.utility.js.map