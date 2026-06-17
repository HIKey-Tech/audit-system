import { z } from 'zod';
import { AuditType } from '../../../domain/enum/audit.enum';
export declare const FrameworkCategory: z.ZodEnum<["it", "financial", "compliance", "systems", "governance"]>;
export declare const CreateFrameworkRequestSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodEnum<["it", "financial", "compliance", "systems", "governance"]>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: "it" | "financial" | "compliance" | "systems" | "governance";
    code: string;
    description?: string | undefined;
    isActive?: boolean | undefined;
}, {
    name: string;
    category: "it" | "financial" | "compliance" | "systems" | "governance";
    code: string;
    description?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const UpdateFrameworkRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodEnum<["it", "financial", "compliance", "systems", "governance"]>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    category?: "it" | "financial" | "compliance" | "systems" | "governance" | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    category?: "it" | "financial" | "compliance" | "systems" | "governance" | undefined;
    isActive?: boolean | undefined;
}>;
export declare const CreateControlRequestSchema: z.ZodObject<{
    frameworkId: z.ZodString;
    controlReference: z.ZodString;
    controlDescription: z.ZodString;
    testProcedure: z.ZodString;
    auditType: z.ZodNativeEnum<typeof AuditType>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    auditType: AuditType;
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
    frameworkId: string;
    isActive?: boolean | undefined;
}, {
    auditType: AuditType;
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
    frameworkId: string;
    isActive?: boolean | undefined;
}>;
export declare const UpdateControlRequestSchema: z.ZodObject<{
    frameworkId: z.ZodOptional<z.ZodString>;
    controlReference: z.ZodOptional<z.ZodString>;
    controlDescription: z.ZodOptional<z.ZodString>;
    testProcedure: z.ZodOptional<z.ZodString>;
    auditType: z.ZodOptional<z.ZodNativeEnum<typeof AuditType>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
    auditType?: AuditType | undefined;
    controlReference?: string | undefined;
    controlDescription?: string | undefined;
    testProcedure?: string | undefined;
    frameworkId?: string | undefined;
}, {
    isActive?: boolean | undefined;
    auditType?: AuditType | undefined;
    controlReference?: string | undefined;
    controlDescription?: string | undefined;
    testProcedure?: string | undefined;
    frameworkId?: string | undefined;
}>;
export declare const ControlQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    frameworkId: z.ZodOptional<z.ZodString>;
    auditType: z.ZodOptional<z.ZodNativeEnum<typeof AuditType>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
    isActive?: boolean | undefined;
    auditType?: AuditType | undefined;
    frameworkId?: string | undefined;
}, {
    search?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    isActive?: boolean | undefined;
    auditType?: AuditType | undefined;
    frameworkId?: string | undefined;
}>;
export declare const LinkRiskRequestSchema: z.ZodObject<{
    riskId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    riskId: string;
}, {
    riskId: string;
}>;
export type LinkRiskRequestDto = z.infer<typeof LinkRiskRequestSchema>;
export type CreateFrameworkRequestDto = z.infer<typeof CreateFrameworkRequestSchema>;
export type UpdateFrameworkRequestDto = z.infer<typeof UpdateFrameworkRequestSchema>;
export type CreateControlRequestDto = z.infer<typeof CreateControlRequestSchema>;
export type UpdateControlRequestDto = z.infer<typeof UpdateControlRequestSchema>;
export type ControlQueryDto = z.infer<typeof ControlQuerySchema>;
//# sourceMappingURL=compliance.request.dto.d.ts.map