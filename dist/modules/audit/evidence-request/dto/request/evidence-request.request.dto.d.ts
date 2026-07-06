import { z } from 'zod';
export declare const CreateEvidenceRequestSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodDate>;
    /** Defaults to the engagement's auditee when omitted. */
    assignedToId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description?: string | undefined;
    dueDate?: Date | undefined;
    assignedToId?: string | undefined;
}, {
    title: string;
    description?: string | undefined;
    dueDate?: Date | undefined;
    assignedToId?: string | undefined;
}>;
export type CreateEvidenceRequestDto = z.infer<typeof CreateEvidenceRequestSchema>;
export declare const ReturnEvidenceRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type ReturnEvidenceRequestDto = z.infer<typeof ReturnEvidenceRequestSchema>;
//# sourceMappingURL=evidence-request.request.dto.d.ts.map