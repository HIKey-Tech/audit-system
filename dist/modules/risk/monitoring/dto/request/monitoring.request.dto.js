"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmergingRiskQuerySchema = exports.HighRiskQuerySchema = void 0;
const zod_1 = require("zod");
exports.HighRiskQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    threshold: zod_1.z.coerce.number().int().min(1).max(25).default(13),
});
exports.EmergingRiskQuerySchema = zod_1.z.object({
    days: zod_1.z.coerce.number().int().min(7).max(365).default(90),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
//# sourceMappingURL=monitoring.request.dto.js.map