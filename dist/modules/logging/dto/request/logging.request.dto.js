"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogSummaryQuerySchema = exports.AuditLogIdParamsSchema = exports.AuditLogListQuerySchema = void 0;
const zod_1 = require("zod");
exports.AuditLogListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    userId: zod_1.z.string().uuid().optional(),
    module: zod_1.z.string().min(1).max(100).optional(),
    entityType: zod_1.z.string().min(1).max(100).optional(),
    entityId: zod_1.z.string().uuid().optional(),
    action: zod_1.z.string().min(1).max(255).optional(),
    status: zod_1.z.enum(['success', 'failure']).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
    sortBy: zod_1.z.enum(['createdAt']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.AuditLogIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.AuditLogSummaryQuerySchema = zod_1.z.object({
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
//# sourceMappingURL=logging.request.dto.js.map