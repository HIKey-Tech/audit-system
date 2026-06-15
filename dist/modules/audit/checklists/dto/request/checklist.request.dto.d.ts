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
export type CreateChecklistItemRequestDto = z.infer<typeof CreateChecklistItemRequestSchema>;
export type UpdateChecklistItemRequestDto = z.infer<typeof UpdateChecklistItemRequestSchema>;
//# sourceMappingURL=checklist.request.dto.d.ts.map