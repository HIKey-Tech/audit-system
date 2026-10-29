import { z } from 'zod';
export declare const ReportSignOffModeSchema: z.ZodEnum<["cae_only", "cae_and_dg"]>;
export type ReportSignOffMode = z.infer<typeof ReportSignOffModeSchema>;
export declare const GenerateReportRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    executiveSummary: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    methodology: z.ZodOptional<z.ZodString>;
    templateId: z.ZodOptional<z.ZodString>;
    signOffMode: z.ZodOptional<z.ZodEnum<["cae_only", "cae_and_dg"]>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    scope?: string | undefined;
    methodology?: string | undefined;
    executiveSummary?: string | undefined;
    templateId?: string | undefined;
    signOffMode?: "cae_only" | "cae_and_dg" | undefined;
}, {
    title?: string | undefined;
    scope?: string | undefined;
    methodology?: string | undefined;
    executiveSummary?: string | undefined;
    templateId?: string | undefined;
    signOffMode?: "cae_only" | "cae_and_dg" | undefined;
}>;
export declare const UpdateReportRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    executiveSummary: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    methodology: z.ZodOptional<z.ZodString>;
    templateId: z.ZodOptional<z.ZodString>;
    signOffMode: z.ZodOptional<z.ZodEnum<["cae_only", "cae_and_dg"]>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    scope?: string | undefined;
    methodology?: string | undefined;
    executiveSummary?: string | undefined;
    templateId?: string | undefined;
    signOffMode?: "cae_only" | "cae_and_dg" | undefined;
}, {
    title?: string | undefined;
    scope?: string | undefined;
    methodology?: string | undefined;
    executiveSummary?: string | undefined;
    templateId?: string | undefined;
    signOffMode?: "cae_only" | "cae_and_dg" | undefined;
}>;
export declare const RejectReportRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const AddReportCommentRequestSchema: z.ZodObject<{
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
}, {
    body: string;
}>;
export declare const ExportReportQuerySchema: z.ZodObject<{
    format: z.ZodOptional<z.ZodEnum<["docx", "pdf"]>>;
}, "strip", z.ZodTypeAny, {
    format?: "docx" | "pdf" | undefined;
}, {
    format?: "docx" | "pdf" | undefined;
}>;
export declare const ReportQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["created_at", "updated_at", "issued_at", "status", "title"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "updated_at" | "status" | "title" | "issued_at";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    status?: string | undefined;
}, {
    search?: string | undefined;
    status?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "updated_at" | "status" | "title" | "issued_at" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type GenerateReportRequestDto = z.infer<typeof GenerateReportRequestSchema>;
export type UpdateReportRequestDto = z.infer<typeof UpdateReportRequestSchema>;
export type RejectReportRequestDto = z.infer<typeof RejectReportRequestSchema>;
export type AddReportCommentRequestDto = z.infer<typeof AddReportCommentRequestSchema>;
export type ExportReportQueryDto = z.infer<typeof ExportReportQuerySchema>;
export type ReportQueryDto = z.infer<typeof ReportQuerySchema>;
//# sourceMappingURL=report.request.dto.d.ts.map