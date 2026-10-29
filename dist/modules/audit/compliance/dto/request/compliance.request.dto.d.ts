import { z } from 'zod';
import { AuditType } from '../../../domain/enum/audit.enum';
export declare const FrameworkCategory: z.ZodEnum<["it", "financial", "compliance", "systems", "governance", "regulatory", "standard", "policy", "act", "operational", "pension", "procurement", "hr_payroll", "project", "special"]>;
export declare const CreateFrameworkRequestSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodEnum<["it", "financial", "compliance", "systems", "governance", "regulatory", "standard", "policy", "act", "operational", "pension", "procurement", "hr_payroll", "project", "special"]>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: "policy" | "standard" | "it" | "systems" | "financial" | "compliance" | "operational" | "pension" | "procurement" | "hr_payroll" | "project" | "special" | "regulatory" | "governance" | "act";
    code: string;
    description?: string | undefined;
    isActive?: boolean | undefined;
}, {
    name: string;
    category: "policy" | "standard" | "it" | "systems" | "financial" | "compliance" | "operational" | "pension" | "procurement" | "hr_payroll" | "project" | "special" | "regulatory" | "governance" | "act";
    code: string;
    description?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const UpdateFrameworkRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodEnum<["it", "financial", "compliance", "systems", "governance", "regulatory", "standard", "policy", "act", "operational", "pension", "procurement", "hr_payroll", "project", "special"]>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    category?: "policy" | "standard" | "it" | "systems" | "financial" | "compliance" | "operational" | "pension" | "procurement" | "hr_payroll" | "project" | "special" | "regulatory" | "governance" | "act" | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    category?: "policy" | "standard" | "it" | "systems" | "financial" | "compliance" | "operational" | "pension" | "procurement" | "hr_payroll" | "project" | "special" | "regulatory" | "governance" | "act" | undefined;
    isActive?: boolean | undefined;
}>;
export declare const CreateControlRequestSchema: z.ZodObject<{
    frameworkId: z.ZodString;
    controlReference: z.ZodString;
    controlDescription: z.ZodString;
    testProcedure: z.ZodString;
    auditType: z.ZodEnum<[AuditType.It, AuditType.Systems, AuditType.Financial, AuditType.Compliance, AuditType.Operational, AuditType.Pension, AuditType.Procurement, AuditType.HrPayroll, AuditType.Project, AuditType.Special]>;
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
    auditType: z.ZodOptional<z.ZodEnum<[AuditType.It, AuditType.Systems, AuditType.Financial, AuditType.Compliance, AuditType.Operational, AuditType.Pension, AuditType.Procurement, AuditType.HrPayroll, AuditType.Project, AuditType.Special]>>;
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
    auditType: z.ZodOptional<z.ZodEnum<[AuditType.It, AuditType.Systems, AuditType.Financial, AuditType.Compliance, AuditType.Operational, AuditType.Pension, AuditType.Procurement, AuditType.HrPayroll, AuditType.Project, AuditType.Special]>>;
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
export interface UploadFrameworkDocumentDto {
    frameworkId?: string;
    code?: string;
    name?: string;
    category?: string;
    description?: string;
    auditType?: string;
    prefix?: string;
    controls?: Array<{
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }>;
}
export type LinkRiskRequestDto = z.infer<typeof LinkRiskRequestSchema>;
export type CreateFrameworkRequestDto = z.infer<typeof CreateFrameworkRequestSchema>;
export type UpdateFrameworkRequestDto = z.infer<typeof UpdateFrameworkRequestSchema>;
export type CreateControlRequestDto = z.infer<typeof CreateControlRequestSchema>;
export type UpdateControlRequestDto = z.infer<typeof UpdateControlRequestSchema>;
export type ControlQueryDto = z.infer<typeof ControlQuerySchema>;
//# sourceMappingURL=compliance.request.dto.d.ts.map