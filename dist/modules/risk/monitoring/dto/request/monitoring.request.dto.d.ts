import { z } from 'zod';
export declare const HighRiskQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    threshold: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    threshold: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    threshold?: number | undefined;
}>;
export declare const EmergingRiskQuerySchema: z.ZodObject<{
    days: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    days: number;
    limit: number;
}, {
    days?: number | undefined;
    limit?: number | undefined;
}>;
export type HighRiskQueryDto = z.infer<typeof HighRiskQuerySchema>;
export type EmergingRiskQueryDto = z.infer<typeof EmergingRiskQuerySchema>;
//# sourceMappingURL=monitoring.request.dto.d.ts.map