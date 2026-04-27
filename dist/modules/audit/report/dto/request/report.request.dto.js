"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RejectReportRequestSchema = exports.UpdateReportRequestSchema = void 0;
const zod_1 = require("zod");
exports.UpdateReportRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    executiveSummary: zod_1.z.string().min(1).optional(),
    scope: zod_1.z.string().min(1).optional(),
    methodology: zod_1.z.string().min(1).optional(),
});
exports.RejectReportRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
//# sourceMappingURL=report.request.dto.js.map