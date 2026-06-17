"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkRiskRequestSchema = exports.ControlQuerySchema = exports.UpdateControlRequestSchema = exports.CreateControlRequestSchema = exports.UpdateFrameworkRequestSchema = exports.CreateFrameworkRequestSchema = exports.FrameworkCategory = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
exports.FrameworkCategory = zod_1.z.enum(['it', 'financial', 'compliance', 'systems', 'governance']);
exports.CreateFrameworkRequestSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9.\-]+$/, 'Code may contain letters, numbers, dot and hyphen only'),
    name: zod_1.z.string().trim().min(2).max(160),
    description: zod_1.z.string().trim().max(2000).optional(),
    category: exports.FrameworkCategory,
    isActive: zod_1.z.boolean().optional(),
});
exports.UpdateFrameworkRequestSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(160).optional(),
    description: zod_1.z.string().trim().max(2000).nullable().optional(),
    category: exports.FrameworkCategory.optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.CreateControlRequestSchema = zod_1.z.object({
    frameworkId: zod_1.z.string().uuid(),
    controlReference: zod_1.z.string().trim().min(1).max(80),
    controlDescription: zod_1.z.string().trim().min(1),
    testProcedure: zod_1.z.string().trim().min(1),
    auditType: zod_1.z.nativeEnum(audit_enum_1.AuditType),
    isActive: zod_1.z.boolean().optional(),
});
exports.UpdateControlRequestSchema = zod_1.z.object({
    frameworkId: zod_1.z.string().uuid().optional(),
    controlReference: zod_1.z.string().trim().min(1).max(80).optional(),
    controlDescription: zod_1.z.string().trim().min(1).optional(),
    testProcedure: zod_1.z.string().trim().min(1).optional(),
    auditType: zod_1.z.nativeEnum(audit_enum_1.AuditType).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.ControlQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(200).default(50),
    search: zod_1.z.string().trim().optional(),
    frameworkId: zod_1.z.string().uuid().optional(),
    auditType: zod_1.z.nativeEnum(audit_enum_1.AuditType).optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
});
exports.LinkRiskRequestSchema = zod_1.z.object({
    riskId: zod_1.z.string().uuid(),
});
//# sourceMappingURL=compliance.request.dto.js.map