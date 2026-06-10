"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportQuerySchema = exports.ExportReportQuerySchema = exports.RejectReportRequestSchema = exports.UpdateReportRequestSchema = exports.GenerateReportRequestSchema = void 0;
const zod_1 = require("zod");
exports.GenerateReportRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    executiveSummary: zod_1.z.string().min(1).optional(),
    scope: zod_1.z.string().min(1).optional(),
    methodology: zod_1.z.string().min(1).optional(),
    templateId: zod_1.z.string().uuid().optional(),
});
exports.UpdateReportRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    executiveSummary: zod_1.z.string().min(1).optional(),
    scope: zod_1.z.string().min(1).optional(),
    methodology: zod_1.z.string().min(1).optional(),
    templateId: zod_1.z.string().uuid().optional(),
});
exports.RejectReportRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
exports.ExportReportQuerySchema = zod_1.z.object({
    format: zod_1.z.enum(['docx', 'pdf']).optional(),
});
exports.ReportQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.string().trim().optional(),
    search: zod_1.z.string().trim().optional(),
    sortBy: zod_1.z.enum(['created_at', 'updated_at', 'issued_at', 'status', 'title']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=report.request.dto.js.map