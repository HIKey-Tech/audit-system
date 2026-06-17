import { z } from 'zod';
import { AuditType, ChecklistResult } from '../../../domain/enum/audit.enum';
export declare const CreateChecklistItemRequestSchema: z.ZodObject<{
    auditType: z.ZodOptional<z.ZodNativeEnum<typeof AuditType>>;
    controlReference: z.ZodString;
    controlDescription: z.ZodString;
    testProcedure: z.ZodString;
}, "strip", z.ZodTypeAny, {
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
    auditType?: AuditType | undefined;
}, {
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
    auditType?: AuditType | undefined;
}>;
export declare const UpdateChecklistItemRequestSchema: z.ZodObject<{
    result: z.ZodNativeEnum<typeof ChecklistResult>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    result: ChecklistResult;
    notes?: string | null | undefined;
}, {
    result: ChecklistResult;
    notes?: string | null | undefined;
}>;
export declare const UpdateChecklistTemplatesRequestSchema: z.ZodObject<{
    templates: z.ZodRecord<z.ZodNativeEnum<typeof AuditType>, z.ZodArray<z.ZodObject<{
        controlReference: z.ZodString;
        controlDescription: z.ZodString;
        testProcedure: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    templates: Partial<Record<AuditType, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }[]>>;
}, {
    templates: Partial<Record<AuditType, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }[]>>;
}>;
export type CreateChecklistItemRequestDto = z.infer<typeof CreateChecklistItemRequestSchema>;
export type UpdateChecklistItemRequestDto = z.infer<typeof UpdateChecklistItemRequestSchema>;
export type UpdateChecklistTemplatesRequestDto = z.infer<typeof UpdateChecklistTemplatesRequestSchema>;
//# sourceMappingURL=checklist.request.dto.d.ts.map