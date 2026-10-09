"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogSummaryQuerySchema = exports.AuditLogIdParamsSchema = exports.SystemLogListQuerySchema = exports.SecuritySummaryQuerySchema = exports.AuditLogExportQuerySchema = exports.AuditLogListQuerySchema = void 0;
const zod_1 = require("zod");
const tabular_export_util_1 = require("../../../../shared/utils/tabular-export.util");
// Query strings arrive as text; z.coerce.boolean() would read "false" as true.
const QueryBooleanSchema = zod_1.z.enum(['true', 'false']).transform((v) => v === 'true');
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
    /** Only entries that recorded a data change (old/new values) — the change history view. */
    hasChanges: QueryBooleanSchema.optional(),
    sortBy: zod_1.z.enum(['createdAt']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.AuditLogExportQuerySchema = exports.AuditLogListQuerySchema.omit({ page: true, pageSize: true }).extend({
    format: tabular_export_util_1.ExportFormatSchema,
});
exports.SecuritySummaryQuerySchema = zod_1.z.object({
    days: zod_1.z.coerce.number().int().min(1).max(90).default(7),
});
exports.SystemLogListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    source: zod_1.z.enum(['http', 'job', 'app']).optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
exports.AuditLogIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.AuditLogSummaryQuerySchema = zod_1.z.object({
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
//# sourceMappingURL=logging.request.dto.js.map