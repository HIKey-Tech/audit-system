import { z } from 'zod';
import { FindingSeverity } from '../../../../audit/domain/enum/audit.enum';
import { AnalysisSource, AnalysisType, ExceptionDisposition, ExceptionSeverity, RunReviewStatus, RunTrigger } from '../../../domain/enum/system-audit.enum';
export declare const PreviewExtractSchema: z.ZodObject<{
    analysisType: z.ZodNativeEnum<typeof AnalysisType>;
}, "strip", z.ZodTypeAny, {
    analysisType: AnalysisType;
}, {
    analysisType: AnalysisType;
}>;
export declare const RunUploadAnalysisSchema: z.ZodObject<{
    analysisType: z.ZodNativeEnum<typeof AnalysisType>;
    systemName: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    engagementId: z.ZodOptional<z.ZodString>;
    securityTestId: z.ZodOptional<z.ZodString>;
    /** Configuration runs: compare against this baseline instead of the system's current one. */
    baselineRunId: z.ZodOptional<z.ZodString>;
    dateOrder: z.ZodDefault<z.ZodEnum<["dmy", "mdy"]>>;
    mapping: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, unknown, string>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodString>>>>;
    parameters: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, unknown, string>, z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    systemName: string;
    analysisType: AnalysisType;
    dateOrder: "dmy" | "mdy";
    title?: string | undefined;
    parameters?: Record<string, unknown> | undefined;
    engagementId?: string | undefined;
    securityTestId?: string | undefined;
    baselineRunId?: string | undefined;
    mapping?: Record<string, string | null> | undefined;
}, {
    systemName: string;
    analysisType: AnalysisType;
    title?: string | undefined;
    parameters?: string | undefined;
    engagementId?: string | undefined;
    securityTestId?: string | undefined;
    baselineRunId?: string | undefined;
    dateOrder?: "dmy" | "mdy" | undefined;
    mapping?: string | undefined;
}>;
export declare const RunLiveAnalysisSchema: z.ZodObject<{
    analysisType: z.ZodNativeEnum<typeof AnalysisType>;
    source: z.ZodEnum<[AnalysisSource.Iams, AnalysisSource.EntraId, AnalysisSource.Imoc]>;
    title: z.ZodOptional<z.ZodString>;
    engagementId: z.ZodOptional<z.ZodString>;
    /** Look-back window for event and incident sources. */
    days: z.ZodDefault<z.ZodNumber>;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    source: AnalysisSource.Iams | AnalysisSource.EntraId | AnalysisSource.Imoc;
    days: number;
    analysisType: AnalysisType;
    title?: string | undefined;
    parameters?: Record<string, unknown> | undefined;
    engagementId?: string | undefined;
}, {
    source: AnalysisSource.Iams | AnalysisSource.EntraId | AnalysisSource.Imoc;
    analysisType: AnalysisType;
    title?: string | undefined;
    parameters?: Record<string, unknown> | undefined;
    days?: number | undefined;
    engagementId?: string | undefined;
}>;
export declare const RunListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    analysisType: z.ZodOptional<z.ZodNativeEnum<typeof AnalysisType>>;
    source: z.ZodOptional<z.ZodNativeEnum<typeof AnalysisSource>>;
    trigger: z.ZodOptional<z.ZodNativeEnum<typeof RunTrigger>>;
    reviewStatus: z.ZodOptional<z.ZodNativeEnum<typeof RunReviewStatus>>;
    engagementId: z.ZodOptional<z.ZodString>;
    securityTestId: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
    source?: AnalysisSource | undefined;
    trigger?: RunTrigger | undefined;
    engagementId?: string | undefined;
    analysisType?: AnalysisType | undefined;
    securityTestId?: string | undefined;
    reviewStatus?: RunReviewStatus | undefined;
}, {
    search?: string | undefined;
    source?: AnalysisSource | undefined;
    trigger?: RunTrigger | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    engagementId?: string | undefined;
    analysisType?: AnalysisType | undefined;
    securityTestId?: string | undefined;
    reviewStatus?: RunReviewStatus | undefined;
}>;
export declare const ExceptionListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    severity: z.ZodOptional<z.ZodNativeEnum<typeof ExceptionSeverity>>;
    disposition: z.ZodOptional<z.ZodNativeEnum<typeof ExceptionDisposition>>;
    ruleCode: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
    severity?: ExceptionSeverity | undefined;
    disposition?: ExceptionDisposition | undefined;
    ruleCode?: string | undefined;
}, {
    search?: string | undefined;
    severity?: ExceptionSeverity | undefined;
    disposition?: ExceptionDisposition | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    ruleCode?: string | undefined;
}>;
export declare const ExceptionExportQuerySchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodEnum<["csv", "xlsx"]>>;
}, "strip", z.ZodTypeAny, {
    format: "csv" | "xlsx";
}, {
    format?: "csv" | "xlsx" | undefined;
}>;
export declare const DispositionExceptionsSchema: z.ZodEffects<z.ZodObject<{
    exceptionIds: z.ZodArray<z.ZodString, "many">;
    disposition: z.ZodEnum<[ExceptionDisposition.Confirmed, ExceptionDisposition.FalsePositive, ExceptionDisposition.Explained, ExceptionDisposition.Open]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    disposition: ExceptionDisposition;
    exceptionIds: string[];
    note?: string | undefined;
}, {
    disposition: ExceptionDisposition;
    exceptionIds: string[];
    note?: string | undefined;
}>, {
    disposition: ExceptionDisposition;
    exceptionIds: string[];
    note?: string | undefined;
}, {
    disposition: ExceptionDisposition;
    exceptionIds: string[];
    note?: string | undefined;
}>;
export declare const RaiseFindingSchema: z.ZodObject<{
    exceptionIds: z.ZodArray<z.ZodString, "many">;
    /** Required when the run is not linked to an engagement. */
    engagementId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodDefault<z.ZodEnum<[import("../../../../audit/domain/enum/audit.enum").FindingCategory.It, import("../../../../audit/domain/enum/audit.enum").FindingCategory.Financial, import("../../../../audit/domain/enum/audit.enum").FindingCategory.Compliance, import("../../../../audit/domain/enum/audit.enum").FindingCategory.Operational]>>;
    severity: z.ZodNativeEnum<typeof FindingSeverity>;
    rootCause: z.ZodString;
    riskImplication: z.ZodString;
    recommendation: z.ZodString;
    auditeeId: z.ZodString;
    dueDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    category: import("../../../../audit/domain/enum/audit.enum").FindingCategory.It | import("../../../../audit/domain/enum/audit.enum").FindingCategory.Financial | import("../../../../audit/domain/enum/audit.enum").FindingCategory.Compliance | import("../../../../audit/domain/enum/audit.enum").FindingCategory.Operational;
    severity: FindingSeverity;
    recommendation: string;
    auditeeId: string;
    rootCause: string;
    riskImplication: string;
    dueDate: string;
    exceptionIds: string[];
    description?: string | undefined;
    engagementId?: string | undefined;
}, {
    title: string;
    severity: FindingSeverity;
    recommendation: string;
    auditeeId: string;
    rootCause: string;
    riskImplication: string;
    dueDate: string;
    exceptionIds: string[];
    description?: string | undefined;
    category?: import("../../../../audit/domain/enum/audit.enum").FindingCategory.It | import("../../../../audit/domain/enum/audit.enum").FindingCategory.Financial | import("../../../../audit/domain/enum/audit.enum").FindingCategory.Compliance | import("../../../../audit/domain/enum/audit.enum").FindingCategory.Operational | undefined;
    engagementId?: string | undefined;
}>;
export declare const CompleteReviewSchema: z.ZodObject<{
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
}, {
    note?: string | undefined;
}>;
export type PreviewExtractDto = z.infer<typeof PreviewExtractSchema>;
export type RunUploadAnalysisDto = z.infer<typeof RunUploadAnalysisSchema>;
export type RunLiveAnalysisDto = z.infer<typeof RunLiveAnalysisSchema>;
export type RunListQueryDto = z.infer<typeof RunListQuerySchema>;
export type ExceptionListQueryDto = z.infer<typeof ExceptionListQuerySchema>;
export type ExceptionExportQueryDto = z.infer<typeof ExceptionExportQuerySchema>;
export type DispositionExceptionsDto = z.infer<typeof DispositionExceptionsSchema>;
export type RaiseFindingDto = z.infer<typeof RaiseFindingSchema>;
export type CompleteReviewDto = z.infer<typeof CompleteReviewSchema>;
//# sourceMappingURL=analytics.request.dto.d.ts.map