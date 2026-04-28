import { z } from 'zod';
import { EscalationPolicyAuditType, WorkflowEscalationEntityType } from '../../../domain/enum/workflow.enum';
export declare const EscalationEntityParamsSchema: z.ZodObject<{
    type: z.ZodNativeEnum<typeof WorkflowEscalationEntityType>;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: WorkflowEscalationEntityType;
}, {
    id: string;
    type: WorkflowEscalationEntityType;
}>;
export declare const EscalationPolicyQuerySchema: z.ZodObject<{
    auditType: z.ZodDefault<z.ZodNativeEnum<typeof EscalationPolicyAuditType>>;
}, "strip", z.ZodTypeAny, {
    auditType: EscalationPolicyAuditType;
}, {
    auditType?: EscalationPolicyAuditType | undefined;
}>;
export declare const UpsertEscalationPolicyRequestSchema: z.ZodObject<{
    auditType: z.ZodNativeEnum<typeof EscalationPolicyAuditType>;
    level1Hours: z.ZodDefault<z.ZodNumber>;
    level2Hours: z.ZodDefault<z.ZodNumber>;
    level3Hours: z.ZodDefault<z.ZodNumber>;
    level4Hours: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    auditType: EscalationPolicyAuditType;
    level1Hours: number;
    level2Hours: number;
    level3Hours: number;
    level4Hours: number;
}, {
    auditType: EscalationPolicyAuditType;
    isActive?: boolean | undefined;
    level1Hours?: number | undefined;
    level2Hours?: number | undefined;
    level3Hours?: number | undefined;
    level4Hours?: number | undefined;
}>;
export type EscalationPolicyQueryDto = z.infer<typeof EscalationPolicyQuerySchema>;
export type UpsertEscalationPolicyRequestDto = z.infer<typeof UpsertEscalationPolicyRequestSchema>;
//# sourceMappingURL=escalation.request.dto.d.ts.map