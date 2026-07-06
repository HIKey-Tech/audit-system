"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EligibleUsersQuerySchema = exports.EngagementQuerySchema = exports.UpdateEngagementStatusRequestSchema = exports.UpdateEngagementRequestSchema = exports.CreateAdhocEngagementRequestSchema = exports.CreateEngagementFromPlanRequestSchema = exports.ChecklistControlSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
/**
 * A single checklist control the engagement creator can customise before the
 * engagement starts. Snapshotted onto the engagement; used to populate its
 * checklist instead of the global per-audit-type template when provided.
 */
exports.ChecklistControlSchema = zod_1.z.object({
    controlReference: zod_1.z.string().min(1).max(100),
    controlDescription: zod_1.z.string().min(1).max(2000),
    testProcedure: zod_1.z.string().min(1).max(4000),
});
const EngagementBaseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    leadAuditorId: zod_1.z.string().uuid(),
    auditManagerId: zod_1.z.string().uuid(),
    auditeeId: zod_1.z.string().uuid(),
    plannedStartDate: zod_1.z.string().datetime(),
    plannedEndDate: zod_1.z.string().datetime(),
    slaDeadline: zod_1.z.string().datetime(),
    plannedHours: zod_1.z.number().int().positive().max(100000).optional(),
    checklistControls: zod_1.z.array(exports.ChecklistControlSchema).max(200).optional(),
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
    plannedHours: zod_1.z.number().int().positive().max(100000).nullable().optional(),
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
exports.EligibleUsersQuerySchema = zod_1.z.object({
    role: zod_1.z.enum(['lead_auditor', 'audit_manager']),
    auditType: zod_1.z.nativeEnum(audit_enum_1.AuditType).optional(),
    priority: zod_1.z.nativeEnum(audit_enum_1.AuditPriority).optional(),
});
//# sourceMappingURL=engagement.request.dto.js.map