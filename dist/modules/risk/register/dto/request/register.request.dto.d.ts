import { z } from 'zod';
import { RiskStatus } from '../../../domain/enum/risk.enum';
export declare const CreateRiskRequestSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    categoryId: z.ZodString;
    ownerId: z.ZodString;
    likelihood: z.ZodNumber;
    impact: z.ZodNumber;
    status: z.ZodDefault<z.ZodNativeEnum<typeof RiskStatus>>;
    universeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: RiskStatus;
    title: string;
    description: string;
    likelihood: number;
    impact: number;
    categoryId: string;
    ownerId: string;
    universeId?: string | null | undefined;
}, {
    title: string;
    description: string;
    likelihood: number;
    impact: number;
    categoryId: string;
    ownerId: string;
    status?: RiskStatus | undefined;
    universeId?: string | null | undefined;
}>;
export declare const UpdateRiskRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    ownerId: z.ZodOptional<z.ZodString>;
    likelihood: z.ZodOptional<z.ZodNumber>;
    impact: z.ZodOptional<z.ZodNumber>;
    universeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | undefined;
    likelihood?: number | undefined;
    impact?: number | undefined;
    categoryId?: string | undefined;
    ownerId?: string | undefined;
    universeId?: string | null | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    likelihood?: number | undefined;
    impact?: number | undefined;
    categoryId?: string | undefined;
    ownerId?: string | undefined;
    universeId?: string | null | undefined;
}>;
export declare const UpdateRiskStatusRequestSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof RiskStatus>;
}, "strip", z.ZodTypeAny, {
    status: RiskStatus;
}, {
    status: RiskStatus;
}>;
export declare const RiskRegisterQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    categoryId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof RiskStatus>>;
    ownerId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["current_score", "title", "created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "updated_at" | "title" | "current_score";
    sortOrder: "asc" | "desc";
    status?: RiskStatus | undefined;
    categoryId?: string | undefined;
    ownerId?: string | undefined;
}, {
    status?: RiskStatus | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "updated_at" | "title" | "current_score" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    categoryId?: string | undefined;
    ownerId?: string | undefined;
}>;
export type CreateRiskRequestDto = z.infer<typeof CreateRiskRequestSchema>;
export type UpdateRiskRequestDto = z.infer<typeof UpdateRiskRequestSchema>;
export type UpdateRiskStatusRequestDto = z.infer<typeof UpdateRiskStatusRequestSchema>;
export type RiskRegisterQueryDto = z.infer<typeof RiskRegisterQuerySchema>;
//# sourceMappingURL=register.request.dto.d.ts.map