import { z } from 'zod';
export declare const CreateRiskCategoryRequestSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
export declare const UpdateRiskCategoryRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    isActive?: boolean | undefined;
}>;
export declare const RiskCategoryQuerySchema: z.ZodObject<{
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
}, {
    isActive?: boolean | undefined;
}>;
export type CreateRiskCategoryRequestDto = z.infer<typeof CreateRiskCategoryRequestSchema>;
export type UpdateRiskCategoryRequestDto = z.infer<typeof UpdateRiskCategoryRequestSchema>;
export type RiskCategoryQueryDto = z.infer<typeof RiskCategoryQuerySchema>;
//# sourceMappingURL=category.request.dto.d.ts.map