"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemLogService = exports.SystemLogService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const logging_response_dto_1 = require("../../dto/response/logging.response.dto");
class SystemLogService {
    async listSystemLogs(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            ...(query.source && { source: query.source }),
            ...(query.search && {
                OR: [{ message: { contains: query.search } }, { path: { contains: query.search } }],
            }),
            ...((query.dateFrom || query.dateTo) && {
                created_at: {
                    ...(query.dateFrom && { gte: query.dateFrom }),
                    ...(query.dateTo && { lte: query.dateTo }),
                },
            }),
        };
        const [total, logs] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.system_Log.count({ where }),
            prisma_client_1.prisma.system_Log.findMany({ where, orderBy: { created_at: 'desc' }, skip, take }),
        ]);
        return { logs: logs.map(logging_response_dto_1.mapSystemLogToResponse), meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize) };
    }
    async getSystemLogById(id) {
        const log = await prisma_client_1.prisma.system_Log.findUnique({ where: { id } });
        if (!log)
            throw app_error_1.AppError.notFound('System log');
        return (0, logging_response_dto_1.mapSystemLogToResponse)(log);
    }
    async countRecent(days) {
        const grouped = await prisma_client_1.prisma.system_Log.groupBy({
            by: ['source'],
            where: { created_at: { gte: new Date(Date.now() - days * 86_400_000) } },
            _count: { _all: true },
        });
        const bySource = {};
        let total = 0;
        for (const row of grouped) {
            bySource[row.source ?? 'app'] = row._count._all;
            total += row._count._all;
        }
        return { total, bySource };
    }
}
exports.SystemLogService = SystemLogService;
exports.systemLogService = new SystemLogService();
//# sourceMappingURL=system-log.service.js.map