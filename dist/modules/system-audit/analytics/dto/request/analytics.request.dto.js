"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompleteReviewSchema = exports.RaiseFindingSchema = exports.DispositionExceptionsSchema = exports.ExceptionExportQuerySchema = exports.ExceptionListQuerySchema = exports.RunListQuerySchema = exports.RunLiveAnalysisSchema = exports.RunUploadAnalysisSchema = exports.PreviewExtractSchema = void 0;
const zod_1 = require("zod");
const tabular_export_util_1 = require("../../../../../shared/utils/tabular-export.util");
const audit_enum_1 = require("../../../../audit/domain/enum/audit.enum");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
/** Multipart form fields arrive as text; structured ones are sent as JSON strings. */
const jsonField = (schema) => zod_1.z
    .string()
    .transform((value, ctx) => {
    try {
        return JSON.parse(value);
    }
    catch {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Must be valid JSON' });
        return zod_1.z.NEVER;
    }
})
    .pipe(schema);
const ColumnMappingSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.string().nullable());
const ParametersSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
exports.PreviewExtractSchema = zod_1.z.object({
    analysisType: zod_1.z.nativeEnum(system_audit_enum_1.AnalysisType),
});
exports.RunUploadAnalysisSchema = zod_1.z.object({
    analysisType: zod_1.z.nativeEnum(system_audit_enum_1.AnalysisType),
    systemName: zod_1.z.string().trim().min(1).max(200),
    title: zod_1.z.string().trim().min(1).max(200).optional(),
    engagementId: zod_1.z.string().uuid().optional(),
    securityTestId: zod_1.z.string().uuid().optional(),
    /** Configuration runs: compare against this baseline instead of the system's current one. */
    baselineRunId: zod_1.z.string().uuid().optional(),
    dateOrder: zod_1.z.enum(['dmy', 'mdy']).default('dmy'),
    mapping: jsonField(ColumnMappingSchema).optional(),
    parameters: jsonField(ParametersSchema).optional(),
});
exports.RunLiveAnalysisSchema = zod_1.z.object({
    analysisType: zod_1.z.nativeEnum(system_audit_enum_1.AnalysisType),
    source: zod_1.z.enum([system_audit_enum_1.AnalysisSource.Iams, system_audit_enum_1.AnalysisSource.EntraId, system_audit_enum_1.AnalysisSource.Imoc]),
    title: zod_1.z.string().trim().min(1).max(200).optional(),
    engagementId: zod_1.z.string().uuid().optional(),
    /** Look-back window for event and incident sources. */
    days: zod_1.z.number().int().min(1).max(365).default(30),
    parameters: ParametersSchema.optional(),
});
exports.RunListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    analysisType: zod_1.z.nativeEnum(system_audit_enum_1.AnalysisType).optional(),
    source: zod_1.z.nativeEnum(system_audit_enum_1.AnalysisSource).optional(),
    trigger: zod_1.z.nativeEnum(system_audit_enum_1.RunTrigger).optional(),
    reviewStatus: zod_1.z.nativeEnum(system_audit_enum_1.RunReviewStatus).optional(),
    engagementId: zod_1.z.string().uuid().optional(),
    securityTestId: zod_1.z.string().uuid().optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
});
exports.ExceptionListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(200).default(50),
    severity: zod_1.z.nativeEnum(system_audit_enum_1.ExceptionSeverity).optional(),
    disposition: zod_1.z.nativeEnum(system_audit_enum_1.ExceptionDisposition).optional(),
    ruleCode: zod_1.z.string().trim().min(1).max(100).optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
});
exports.ExceptionExportQuerySchema = zod_1.z.object({ format: tabular_export_util_1.ExportFormatSchema });
exports.DispositionExceptionsSchema = zod_1.z
    .object({
    exceptionIds: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(500),
    disposition: zod_1.z.enum([system_audit_enum_1.ExceptionDisposition.Confirmed, system_audit_enum_1.ExceptionDisposition.FalsePositive, system_audit_enum_1.ExceptionDisposition.Explained, system_audit_enum_1.ExceptionDisposition.Open]),
    note: zod_1.z.string().trim().max(4000).optional(),
})
    .refine((d) => d.disposition === system_audit_enum_1.ExceptionDisposition.Confirmed || d.disposition === system_audit_enum_1.ExceptionDisposition.Open || Boolean(d.note), {
    message: 'Explain why the exception is a false positive or already explained',
    path: ['note'],
});
exports.RaiseFindingSchema = zod_1.z.object({
    exceptionIds: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(100),
    /** Required when the run is not linked to an engagement. */
    engagementId: zod_1.z.string().uuid().optional(),
    title: zod_1.z.string().trim().min(1).max(200),
    description: zod_1.z.string().trim().min(1).max(20_000).optional(),
    category: zod_1.z.enum(audit_enum_1.SELECTABLE_FINDING_CATEGORIES).default(audit_enum_1.SELECTABLE_FINDING_CATEGORIES[0]),
    severity: zod_1.z.nativeEnum(audit_enum_1.FindingSeverity),
    rootCause: zod_1.z.string().trim().min(1).max(10_000),
    riskImplication: zod_1.z.string().trim().min(1).max(10_000),
    recommendation: zod_1.z.string().trim().min(1).max(10_000),
    auditeeId: zod_1.z.string().uuid(),
    dueDate: zod_1.z.string().datetime(),
});
exports.CompleteReviewSchema = zod_1.z.object({
    note: zod_1.z.string().trim().max(4000).optional(),
});
//# sourceMappingURL=analytics.request.dto.js.map