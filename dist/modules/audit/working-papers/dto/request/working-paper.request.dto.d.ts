import { z } from 'zod';
export declare const CreateWorkingPaperRequestSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
}, {
    title: string;
    content: string;
}>;
export declare const UpdateWorkingPaperRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    content?: string | undefined;
}, {
    title?: string | undefined;
    content?: string | undefined;
}>;
export declare const RejectWorkingPaperRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type CreateWorkingPaperRequestDto = z.infer<typeof CreateWorkingPaperRequestSchema>;
export type UpdateWorkingPaperRequestDto = z.infer<typeof UpdateWorkingPaperRequestSchema>;
export type RejectWorkingPaperRequestDto = z.infer<typeof RejectWorkingPaperRequestSchema>;
//# sourceMappingURL=working-paper.request.dto.d.ts.map