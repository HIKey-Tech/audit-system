"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingQuerySchema = exports.UpdateFindingStatusRequestSchema = exports.UpdateFindingRequestSchema = exports.CreateFindingRequestSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
exports.CreateFindingRequestSchema = zod_1.z.object({
    workingPaperId: zod_1.z.string().uuid().optional(),
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().min(1),
    category: zod_1.z.nativeEnum(audit_enum_1.FindingCategory),
    severity: zod_1.z.nativeEnum(audit_enum_1.FindingSeverity),
    rootCause: zod_1.z.string().min(1),
    riskImplication: zod_1.z.string().min(1),
    recommendation: zod_1.z.string().min(1),
    auditeeId: zod_1.z.string().uuid(),
    dueDate: zod_1.z.string().datetime(),
});
exports.UpdateFindingRequestSchema = zod_1.z.object({
    workingPaperId: zod_1.z.string().uuid().nullable().optional(),
    title: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().min(1).optional(),
    category: zod_1.z.nativeEnum(audit_enum_1.FindingCategory).optional(),
    severity: zod_1.z.nativeEnum(audit_enum_1.FindingSeverity).optional(),
    rootCause: zod_1.z.string().min(1).optional(),
    riskImplication: zod_1.z.string().min(1).optional(),
    recommendation: zod_1.z.string().min(1).optional(),
    auditeeId: zod_1.z.string().uuid().optional(),
    dueDate: zod_1.z.string().datetime().optional(),
});
exports.UpdateFindingStatusRequestSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(audit_enum_1.FindingStatus),
});
exports.FindingQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    search: zod_1.z.string().trim().optional(),
    severity: zod_1.z.nativeEnum(audit_enum_1.FindingSeverity).optional(),
    status: zod_1.z.nativeEnum(audit_enum_1.FindingStatus).optional(),
    category: zod_1.z.nativeEnum(audit_enum_1.FindingCategory).optional(),
    auditeeId: zod_1.z.string().uuid().optional(),
    sortBy: zod_1.z.enum(['created_at', 'updated_at', 'due_date', 'severity', 'status']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=finding.request.dto.js.map