"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRunHistoryQuerySchema = exports.JobIdParamsSchema = void 0;
// src/modules/background/dto/request/job.request.dto.ts
const zod_1 = require("zod");
exports.JobIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.JobRunHistoryQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.enum(['running', 'success', 'failure']).optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=job.request.dto.js.map