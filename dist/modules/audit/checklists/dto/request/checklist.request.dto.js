"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateChecklistTemplatesRequestSchema = exports.UpdateChecklistItemRequestSchema = exports.CreateChecklistItemRequestSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
exports.CreateChecklistItemRequestSchema = zod_1.z.object({
    // Optional — defaults to the engagement's own audit type when omitted.
    auditType: zod_1.z.nativeEnum(audit_enum_1.AuditType).optional(),
    controlReference: zod_1.z.string().min(1).max(200),
    controlDescription: zod_1.z.string().min(1),
    testProcedure: zod_1.z.string().min(1),
});
exports.UpdateChecklistItemRequestSchema = zod_1.z.object({
    result: zod_1.z.nativeEnum(audit_enum_1.ChecklistResult),
    notes: zod_1.z.string().max(5000).nullable().optional(),
});
const ChecklistTemplateControlSchema = zod_1.z.object({
    controlReference: zod_1.z.string().min(1).max(200),
    controlDescription: zod_1.z.string().min(1),
    testProcedure: zod_1.z.string().min(1),
});
exports.UpdateChecklistTemplatesRequestSchema = zod_1.z.object({
    templates: zod_1.z.record(zod_1.z.nativeEnum(audit_enum_1.AuditType), zod_1.z.array(ChecklistTemplateControlSchema)),
});
//# sourceMappingURL=checklist.request.dto.js.map