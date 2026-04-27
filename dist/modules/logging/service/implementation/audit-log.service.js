"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogService = exports.AuditLogService = void 0;
// src/modules/logging/service/implementation/audit-log.service.ts
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
class AuditLogService {
    async log(dto) {
        try {
            await prisma_client_1.prisma.audit_Log.create({
                data: {
                    user_id: dto.userId ?? null,
                    action: dto.action,
                    module: dto.module,
                    entity_type: dto.entityType ?? null,
                    entity_id: dto.entityId ?? null,
                    old_values: dto.oldValues ? JSON.stringify(dto.oldValues) : null,
                    new_values: dto.newValues ? JSON.stringify(dto.newValues) : null,
                    ip_address: dto.ipAddress ?? null,
                    user_agent: dto.userAgent ?? null,
                    status: dto.status ?? 'success',
                    error_message: dto.errorMessage ?? null,
                    duration_ms: dto.durationMs ?? null,
                },
            });
        }
        catch (err) {
            // Logging must never crash the application
            logger_util_1.logger.error('Failed to persist audit log', { err, dto });
        }
    }
    logAsync(dto) {
        // Fire-and-forget — do not await
        this.log(dto).catch((err) => logger_util_1.logger.error('Async audit log failed', { err }));
    }
}
exports.AuditLogService = AuditLogService;
// Singleton for use across the application
exports.auditLogService = new AuditLogService();
//# sourceMappingURL=audit-log.service.js.map