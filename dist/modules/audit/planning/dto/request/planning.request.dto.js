"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanQuerySchema = exports.RejectPlanRequestSchema = exports.AddPlanItemRequestSchema = exports.UpdatePlanRequestSchema = exports.CreatePlanRequestSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
exports.CreatePlanRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    year: zod_1.z.coerce.number().int().min(2000).max(2100),
    // A programme is scoped to one audit type; every plan under it inherits it.
    auditType: zod_1.z.enum(audit_enum_1.SELECTABLE_AUDIT_TYPES),
    description: zod_1.z.string().max(2000).optional(),
});
exports.UpdatePlanRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    year: zod_1.z.coerce.number().int().min(2000).max(2100).optional(),
    description: zod_1.z.string().max(2000).optional(),
});
exports.AddPlanItemRequestSchema = zod_1.z.object({
    universeId: zod_1.z.string().uuid(),
    plannedStartDate: zod_1.z.string().datetime(),
    plannedEndDate: zod_1.z.string().datetime(),
    priority: zod_1.z.nativeEnum(audit_enum_1.AuditPriority),
    notes: zod_1.z.string().max(5000).nullable().optional(),
});
exports.RejectPlanRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
exports.PlanQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.nativeEnum(audit_enum_1.PlanStatus).optional(),
    year: zod_1.z.coerce.number().int().min(2000).max(2100).optional(),
    auditType: zod_1.z.enum(audit_enum_1.SELECTABLE_AUDIT_TYPES).optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
    sortBy: zod_1.z.enum(['year', 'created_at', 'updated_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=planning.request.dto.js.map