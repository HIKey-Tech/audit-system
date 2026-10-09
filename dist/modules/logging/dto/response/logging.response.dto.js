"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSystemLogToResponse = exports.mapAuditLogToResponse = void 0;
const parseJsonValue = (value) => {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
};
const resolveDisplayName = (user) => {
    if (!user)
        return null;
    if (user.display_name && user.display_name.trim())
        return user.display_name.trim();
    const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    if (full)
        return full;
    return user.email ?? null;
};
const mapAuditLogToResponse = (log) => ({
    id: log.id,
    userId: log.user_id,
    userDisplayName: resolveDisplayName(log.user),
    action: log.action,
    module: log.module,
    entityType: log.entity_type,
    entityId: log.entity_id,
    oldValues: parseJsonValue(log.old_values),
    newValues: parseJsonValue(log.new_values),
    ipAddress: log.ip_address,
    userAgent: log.user_agent,
    status: log.status,
    errorMessage: log.error_message,
    durationMs: log.duration_ms,
    createdAt: log.created_at.toISOString(),
});
exports.mapAuditLogToResponse = mapAuditLogToResponse;
const mapSystemLogToResponse = (log) => ({
    id: log.id,
    level: log.level,
    message: log.message,
    source: log.source,
    errorName: log.error_name,
    path: log.path,
    requestId: log.request_id,
    stack: log.stack,
    context: parseJsonValue(log.context),
    createdAt: log.created_at.toISOString(),
});
exports.mapSystemLogToResponse = mapSystemLogToResponse;
//# sourceMappingURL=logging.response.dto.js.map