import { z } from 'zod';
export declare const CreateWorkingPaperRequestSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
    templateId: z.ZodOptional<z.ZodString>;
    sourceDocumentId: z.ZodOptional<z.ZodString>;
    workingPaperType: z.ZodOptional<z.ZodString>;
    importMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
    templateId?: string | undefined;
    sourceDocumentId?: string | undefined;
    workingPaperType?: string | undefined;
    importMetadata?: Record<string, unknown> | undefined;
}, {
    title: string;
    content: string;
    templateId?: string | undefined;
    sourceDocumentId?: string | undefined;
    workingPaperType?: string | undefined;
    importMetadata?: Record<string, unknown> | undefined;
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
export declare const ImportWorkingPaperMetadataSchema: z.ZodObject<{
    templateId: z.ZodOptional<z.ZodString>;
    workingPaperType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    templateId?: string | undefined;
    workingPaperType?: string | undefined;
}, {
    templateId?: string | undefined;
    workingPaperType?: string | undefined;
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
export type ImportWorkingPaperMetadataDto = z.infer<typeof ImportWorkingPaperMetadataSchema>;
export type RejectWorkingPaperRequestDto = z.infer<typeof RejectWorkingPaperRequestSchema>;
export declare const ApproveWorkingPaperRequestSchema: z.ZodObject<{
    edits: z.ZodOptional<z.ZodObject<{
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
    }, {
        content: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    edits?: {
        content: string;
    } | undefined;
}, {
    edits?: {
        content: string;
    } | undefined;
}>;
export declare const AddWorkingPaperCommentSchema: z.ZodObject<{
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
}, {
    body: string;
}>;
export type ApproveWorkingPaperRequestDto = z.infer<typeof ApproveWorkingPaperRequestSchema>;
export type AddWorkingPaperCommentDto = z.infer<typeof AddWorkingPaperCommentSchema>;
//# sourceMappingURL=working-paper.request.dto.d.ts.map