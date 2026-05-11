"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkUpdateSystemConfigRequestSchema = exports.UpdateSystemConfigRequestSchema = exports.ReportTemplateQuerySchema = exports.UpdateReportTemplateRequestSchema = exports.CreateReportTemplateRequestSchema = exports.WorkingPaperTemplateQuerySchema = exports.UpdateWorkingPaperTemplateRequestSchema = exports.CreateWorkingPaperTemplateRequestSchema = void 0;
const zod_1 = require("zod");
const settings_enum_1 = require("../../domain/enum/settings.enum");
const WorkingPaperSectionSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().min(1).max(1000),
    placeholder: zod_1.z.string().min(1).max(2000),
    required: zod_1.z.boolean(),
});
const ReportSectionSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).max(100),
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().min(1).max(1000),
    includeFindings: zod_1.z.boolean(),
});
const ReportVariableSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().min(1).max(1000),
    example: zod_1.z.string().min(1).max(500),
});
const ConfigObjectSchema = zod_1.z.record(zod_1.z.unknown());
exports.CreateWorkingPaperTemplateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(1000).optional(),
    auditType: zod_1.z.enum(settings_enum_1.SETTINGS_AUDIT_TYPES),
    sections: zod_1.z.array(WorkingPaperSectionSchema).min(1),
    isActive: zod_1.z.boolean().optional(),
    isDefault: zod_1.z.boolean().optional(),
});
exports.UpdateWorkingPaperTemplateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(1000).nullable().optional(),
    auditType: zod_1.z.enum(settings_enum_1.SETTINGS_AUDIT_TYPES).optional(),
    sections: zod_1.z.array(WorkingPaperSectionSchema).min(1).optional(),
    isActive: zod_1.z.boolean().optional(),
    isDefault: zod_1.z.boolean().optional(),
});
exports.WorkingPaperTemplateQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    auditType: zod_1.z.enum(settings_enum_1.SETTINGS_AUDIT_TYPES).optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
    sortBy: zod_1.z.enum(['name', 'audit_type', 'created_at', 'updated_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.CreateReportTemplateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(1000).optional(),
    sections: zod_1.z.array(ReportSectionSchema).min(1),
    headerConfig: ConfigObjectSchema.nullable().optional(),
    footerConfig: ConfigObjectSchema.nullable().optional(),
    signatureConfig: ConfigObjectSchema.nullable().optional(),
    availableVariables: zod_1.z.array(ReportVariableSchema).min(1),
    isActive: zod_1.z.boolean().optional(),
    isDefault: zod_1.z.boolean().optional(),
});
exports.UpdateReportTemplateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(1000).nullable().optional(),
    sections: zod_1.z.array(ReportSectionSchema).min(1).optional(),
    headerConfig: ConfigObjectSchema.nullable().optional(),
    footerConfig: ConfigObjectSchema.nullable().optional(),
    signatureConfig: ConfigObjectSchema.nullable().optional(),
    availableVariables: zod_1.z.array(ReportVariableSchema).min(1).optional(),
    isActive: zod_1.z.boolean().optional(),
    isDefault: zod_1.z.boolean().optional(),
});
exports.ReportTemplateQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    isActive: zod_1.z.coerce.boolean().optional(),
    sortBy: zod_1.z.enum(['name', 'created_at', 'updated_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.UpdateSystemConfigRequestSchema = zod_1.z.object({
    value: zod_1.z.string().nullable(),
});
exports.BulkUpdateSystemConfigRequestSchema = zod_1.z.object({
    configs: zod_1.z.array(zod_1.z.object({
        key: zod_1.z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
        value: zod_1.z.string().nullable(),
    })).min(1),
});
//# sourceMappingURL=settings.request.dto.js.map