"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskCategoryQuerySchema = exports.UpdateRiskCategoryRequestSchema = exports.CreateRiskCategoryRequestSchema = void 0;
const zod_1 = require("zod");
exports.CreateRiskCategoryRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(1000).optional(),
});
exports.UpdateRiskCategoryRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().max(1000).nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.RiskCategoryQuerySchema = zod_1.z.object({
    isActive: zod_1.z.coerce.boolean().optional(),
});
//# sourceMappingURL=category.request.dto.js.map