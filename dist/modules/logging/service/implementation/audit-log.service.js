"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogService = exports.AuditLogService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const auditLogUserInclude = {
    user: {
        select: {
            display_name: true,
            first_name: true,
            last_name: true,
            email: true,
        },
    },
};
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const logging_response_dto_1 = require("../../dto/response/logging.response.dto");
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
        // Fire-and-forget - do not await
        this.log(dto).catch((err) => logger_util_1.logger.error('Async audit log failed', { err }));
    }
    async listLogs(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = this._buildWhere(query);
        const [total, logs] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Log.count({ where }),
            prisma_client_1.prisma.audit_Log.findMany({
                where,
                include: auditLogUserInclude,
                orderBy: { created_at: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            logs: logs.map(logging_response_dto_1.mapAuditLogToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async getLogById(id) {
        const log = await prisma_client_1.prisma.audit_Log.findUnique({
            where: { id },
            include: auditLogUserInclude,
        });
        if (!log) {
            throw app_error_1.AppError.notFound('Audit log');
        }
        return (0, logging_response_dto_1.mapAuditLogToResponse)(log);
    }
    async getDistinctModules() {
        const modules = await prisma_client_1.prisma.audit_Log.findMany({
            distinct: ['module'],
            select: { module: true },
            orderBy: { module: 'asc' },
        });
        return modules.map((entry) => entry.module);
    }
    async getLogSummary(query) {
        const where = this._buildDateWhere(query);
        const grouped = await prisma_client_1.prisma.audit_Log.groupBy({
            by: ['module', 'status'],
            where,
            _count: { _all: true },
            orderBy: { module: 'asc' },
        });
        const summaryByModule = new Map();
        grouped.forEach((row) => {
            const current = summaryByModule.get(row.module) ?? {
                module: row.module,
                totalActions: 0,
                successCount: 0,
                failureCount: 0,
            };
            const count = row._count._all;
            current.totalActions += count;
            if (row.status === 'success') {
                current.successCount += count;
            }
            if (row.status === 'failure') {
                current.failureCount += count;
            }
            summaryByModule.set(row.module, current);
        });
        return Array.from(summaryByModule.values());
    }
    _buildWhere(query) {
        return {
            ...(query.userId ? { user_id: query.userId } : {}),
            ...(query.module ? { module: query.module } : {}),
            ...(query.entityType ? { entity_type: query.entityType } : {}),
            ...(query.entityId ? { entity_id: query.entityId } : {}),
            ...(query.action ? { action: { contains: query.action } } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...this._buildDateWhere(query),
        };
    }
    _buildDateWhere(query) {
        if (!query.dateFrom && !query.dateTo) {
            return {};
        }
        return {
            created_at: {
                ...(query.dateFrom ? { gte: query.dateFrom } : {}),
                ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
        };
    }
}
exports.AuditLogService = AuditLogService;
// Singleton for use across the application
exports.auditLogService = new AuditLogService();
//# sourceMappingURL=audit-log.service.js.map