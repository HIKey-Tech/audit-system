import { z } from 'zod';
import { AuditFrequency, UniverseCategory, UniverseStatus } from '../../../domain/enum/audit.enum';
export declare const CreateUniverseRequestSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodNativeEnum<typeof UniverseCategory>;
    ownerId: z.ZodString;
    riskScore: z.ZodOptional<z.ZodNumber>;
    lastAuditedAt: z.ZodOptional<z.ZodString>;
    auditFrequency: z.ZodNativeEnum<typeof AuditFrequency>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: UniverseCategory;
    ownerId: string;
    auditFrequency: AuditFrequency;
    description?: string | undefined;
    riskScore?: number | undefined;
    lastAuditedAt?: string | undefined;
}, {
    name: string;
    category: UniverseCategory;
    ownerId: string;
    auditFrequency: AuditFrequency;
    description?: string | undefined;
    riskScore?: number | undefined;
    lastAuditedAt?: string | undefined;
}>;
export declare const UpdateUniverseRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNativeEnum<typeof UniverseCategory>>;
    ownerId: z.ZodOptional<z.ZodString>;
    riskScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    lastAuditedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    auditFrequency: z.ZodOptional<z.ZodNativeEnum<typeof AuditFrequency>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof UniverseStatus>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    status?: UniverseStatus | undefined;
    description?: string | null | undefined;
    category?: UniverseCategory | undefined;
    ownerId?: string | undefined;
    riskScore?: number | null | undefined;
    lastAuditedAt?: string | null | undefined;
    auditFrequency?: AuditFrequency | undefined;
}, {
    name?: string | undefined;
    status?: UniverseStatus | undefined;
    description?: string | null | undefined;
    category?: UniverseCategory | undefined;
    ownerId?: string | undefined;
    riskScore?: number | null | undefined;
    lastAuditedAt?: string | null | undefined;
    auditFrequency?: AuditFrequency | undefined;
}>;
export declare const UniverseQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    category: z.ZodOptional<z.ZodNativeEnum<typeof UniverseCategory>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof UniverseStatus>>;
    sortBy: z.ZodDefault<z.ZodEnum<["risk_score", "name", "created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "name" | "created_at" | "updated_at" | "risk_score";
    sortOrder: "asc" | "desc";
    status?: UniverseStatus | undefined;
    category?: UniverseCategory | undefined;
}, {
    status?: UniverseStatus | undefined;
    category?: UniverseCategory | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "name" | "created_at" | "updated_at" | "risk_score" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type CreateUniverseRequestDto = z.infer<typeof CreateUniverseRequestSchema>;
export type UpdateUniverseRequestDto = z.infer<typeof UpdateUniverseRequestSchema>;
export type UniverseQueryDto = z.infer<typeof UniverseQuerySchema>;
//# sourceMappingURL=universe.request.dto.d.ts.map