"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementQuerySchema = exports.UpdateEngagementStatusRequestSchema = exports.UpdateEngagementRequestSchema = exports.CreateAdhocEngagementRequestSchema = exports.CreateEngagementFromPlanRequestSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const EngagementBaseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    leadAuditorId: zod_1.z.string().uuid(),
    auditManagerId: zod_1.z.string().uuid(),
    auditeeId: zod_1.z.string().uuid(),
    plannedStartDate: zod_1.z.string().datetime(),
    plannedEndDate: zod_1.z.string().datetime(),
    slaDeadline: zod_1.z.string().datetime(),
});
const EngagementScopeSchema = zod_1.z.object({
    universeId: zod_1.z.string().uuid(),
    auditType: zod_1.z.nativeEnum(audit_enum_1.AuditType),
    priority: zod_1.z.nativeEnum(audit_enum_1.AuditPriority),
});
exports.CreateEngagementFromPlanRequestSchema = EngagementBaseSchema.extend({
    planItemId: zod_1.z.string().uuid(),
}).merge(EngagementScopeSchema.partial());
exports.CreateAdhocEngagementRequestSchema = EngagementBaseSchema.merge(EngagementScopeSchema).extend({
    adhocReason: zod_1.z.string().min(1).max(5000),
});
exports.UpdateEngagementRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    leadAuditorId: zod_1.z.string().uuid().optional(),
    auditManagerId: zod_1.z.string().uuid().optional(),
    auditeeId: zod_1.z.string().uuid().optional(),
    plannedStartDate: zod_1.z.string().datetime().optional(),
    plannedEndDate: zod_1.z.string().datetime().optional(),
    slaDeadline: zod_1.z.string().datetime().optional(),
    priority: zod_1.z.nativeEnum(audit_enum_1.AuditPriority).optional(),
    adhocReason: zod_1.z.string().max(5000).nullable().optional(),
});
exports.UpdateEngagementStatusRequestSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(audit_enum_1.EngagementStatus),
});
exports.EngagementQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.nativeEnum(audit_enum_1.EngagementStatus).optional(),
    auditType: zod_1.z.nativeEnum(audit_enum_1.AuditType).optional(),
    leadAuditorId: zod_1.z.string().uuid().optional(),
    auditManagerId: zod_1.z.string().uuid().optional(),
    sortBy: zod_1.z.enum(['created_at', 'planned_start_date', 'sla_deadline', 'reference_number']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=engagement.request.dto.js.map