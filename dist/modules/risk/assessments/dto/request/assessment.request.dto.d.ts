import { z } from 'zod';
export declare const CreateRiskAssessmentRequestSchema: z.ZodObject<{
    likelihood: z.ZodNumber;
    impact: z.ZodNumber;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    assessedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    likelihood: number;
    impact: number;
    notes?: string | null | undefined;
    assessedAt?: string | undefined;
}, {
    likelihood: number;
    impact: number;
    notes?: string | null | undefined;
    assessedAt?: string | undefined;
}>;
export declare const RiskAssessmentQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type CreateRiskAssessmentRequestDto = z.infer<typeof CreateRiskAssessmentRequestSchema>;
export type RiskAssessmentQueryDto = z.infer<typeof RiskAssessmentQuerySchema>;
//# sourceMappingURL=assessment.request.dto.d.ts.map