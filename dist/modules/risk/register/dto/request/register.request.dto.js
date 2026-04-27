"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskRegisterQuerySchema = exports.UpdateRiskStatusRequestSchema = exports.UpdateRiskRequestSchema = exports.CreateRiskRequestSchema = void 0;
const zod_1 = require("zod");
const risk_enum_1 = require("../../../domain/enum/risk.enum");
const RatingSchema = zod_1.z.coerce.number().int().min(1).max(5);
exports.CreateRiskRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().min(1).max(5000),
    categoryId: zod_1.z.string().uuid(),
    ownerId: zod_1.z.string().uuid(),
    likelihood: RatingSchema,
    impact: RatingSchema,
    status: zod_1.z.nativeEnum(risk_enum_1.RiskStatus).default(risk_enum_1.RiskStatus.Open),
    universeId: zod_1.z.string().uuid().nullable().optional(),
});
exports.UpdateRiskRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().min(1).max(5000).optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    ownerId: zod_1.z.string().uuid().optional(),
    likelihood: RatingSchema.optional(),
    impact: RatingSchema.optional(),
    universeId: zod_1.z.string().uuid().nullable().optional(),
});
exports.UpdateRiskStatusRequestSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(risk_enum_1.RiskStatus),
});
exports.RiskRegisterQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    categoryId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.nativeEnum(risk_enum_1.RiskStatus).optional(),
    ownerId: zod_1.z.string().uuid().optional(),
    sortBy: zod_1.z.enum(['current_score', 'title', 'created_at', 'updated_at']).default('current_score'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=register.request.dto.js.map