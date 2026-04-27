"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskAssessmentQuerySchema = exports.CreateRiskAssessmentRequestSchema = void 0;
const zod_1 = require("zod");
const RatingSchema = zod_1.z.coerce.number().int().min(1).max(5);
exports.CreateRiskAssessmentRequestSchema = zod_1.z.object({
    likelihood: RatingSchema,
    impact: RatingSchema,
    notes: zod_1.z.string().max(5000).nullable().optional(),
    assessedAt: zod_1.z.string().datetime().optional(),
});
exports.RiskAssessmentQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
//# sourceMappingURL=assessment.request.dto.js.map