"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HighRiskQuerySchema = void 0;
const zod_1 = require("zod");
exports.HighRiskQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    threshold: zod_1.z.coerce.number().int().min(1).max(25).default(13),
});
//# sourceMappingURL=monitoring.request.dto.js.map