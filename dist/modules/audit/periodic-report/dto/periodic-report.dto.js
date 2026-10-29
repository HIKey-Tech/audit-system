"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportPeriodicReportQuerySchema = exports.PeriodicReportQuerySchema = void 0;
const zod_1 = require("zod");
exports.PeriodicReportQuerySchema = zod_1.z.object({
    periodType: zod_1.z.enum(['monthly', 'quarterly', 'yearly', 'custom']).default('quarterly'),
    year: zod_1.z.coerce
        .number()
        .int()
        .min(2000)
        .max(2100)
        .default(() => new Date().getFullYear()),
    month: zod_1.z.coerce.number().int().min(1).max(12).optional(),
    quarter: zod_1.z.coerce.number().int().min(1).max(4).optional(),
    startDate: zod_1.z.string().trim().optional(),
    endDate: zod_1.z.string().trim().optional(),
    auditType: zod_1.z.string().trim().optional(),
});
exports.ExportPeriodicReportQuerySchema = exports.PeriodicReportQuerySchema.extend({
    format: zod_1.z.enum(['docx', 'pdf']).default('pdf'),
});
//# sourceMappingURL=periodic-report.dto.js.map