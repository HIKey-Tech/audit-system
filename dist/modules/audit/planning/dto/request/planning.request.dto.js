"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanQuerySchema = exports.RejectPlanRequestSchema = exports.AddPlanItemRequestSchema = exports.CreatePlanRequestSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
exports.CreatePlanRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    year: zod_1.z.coerce.number().int().min(2000).max(2100),
});
exports.AddPlanItemRequestSchema = zod_1.z.object({
    universeId: zod_1.z.string().uuid(),
    auditType: zod_1.z.nativeEnum(audit_enum_1.AuditType),
    plannedStartDate: zod_1.z.string().datetime(),
    plannedEndDate: zod_1.z.string().datetime(),
    priority: zod_1.z.nativeEnum(audit_enum_1.AuditPriority),
});
exports.RejectPlanRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
exports.PlanQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.nativeEnum(audit_enum_1.PlanStatus).optional(),
    year: zod_1.z.coerce.number().int().min(2000).max(2100).optional(),
    sortBy: zod_1.z.enum(['year', 'created_at', 'updated_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=planning.request.dto.js.map