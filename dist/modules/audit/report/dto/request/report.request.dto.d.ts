import { z } from 'zod';
export declare const UpdateReportRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    executiveSummary: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    methodology: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    scope?: string | undefined;
    methodology?: string | undefined;
    executiveSummary?: string | undefined;
}, {
    title?: string | undefined;
    scope?: string | undefined;
    methodology?: string | undefined;
    executiveSummary?: string | undefined;
}>;
export declare const RejectReportRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type UpdateReportRequestDto = z.infer<typeof UpdateReportRequestSchema>;
export type RejectReportRequestDto = z.infer<typeof RejectReportRequestSchema>;
//# sourceMappingURL=report.request.dto.d.ts.map