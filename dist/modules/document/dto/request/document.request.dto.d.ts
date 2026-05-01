import { z } from 'zod';
import { TemplateCategory } from '../../domain/enum/document.enum';
export interface UploadDocumentDto {
    uploadedById: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
    module: string;
    entityType?: string;
    entityId?: string;
}
export interface UploadVersionDto {
    uploadedById: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
    changeNote?: string;
}
export declare const UploadDocumentMetadataSchema: z.ZodObject<{
    module: z.ZodString;
    entityType: z.ZodOptional<z.ZodString>;
    entityId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    module: string;
    entityType?: string | undefined;
    entityId?: string | undefined;
}, {
    module: string;
    entityType?: string | undefined;
    entityId?: string | undefined;
}>;
export declare const UploadVersionMetadataSchema: z.ZodObject<{
    changeNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    changeNote?: string | undefined;
}, {
    changeNote?: string | undefined;
}>;
export declare const DocumentByEntityParamsSchema: z.ZodObject<{
    entityType: z.ZodString;
    entityId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    entityType: string;
    entityId: string;
}, {
    entityType: string;
    entityId: string;
}>;
export declare const DocumentIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const DocumentVersionParamsSchema: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    version: number;
}, {
    id: string;
    version: number;
}>;
export declare const CreateTemplateRequestSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodNativeEnum<typeof TemplateCategory>;
    content: z.ZodOptional<z.ZodString>;
    documentId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: TemplateCategory;
    metadata?: string | undefined;
    description?: string | undefined;
    content?: string | undefined;
    isActive?: boolean | undefined;
    documentId?: string | undefined;
}, {
    name: string;
    category: TemplateCategory;
    metadata?: string | undefined;
    description?: string | undefined;
    content?: string | undefined;
    isActive?: boolean | undefined;
    documentId?: string | undefined;
}>;
export declare const UpdateTemplateRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNativeEnum<typeof TemplateCategory>>;
    content: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    documentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    metadata?: string | null | undefined;
    description?: string | null | undefined;
    category?: TemplateCategory | undefined;
    content?: string | null | undefined;
    isActive?: boolean | undefined;
    documentId?: string | null | undefined;
}, {
    name?: string | undefined;
    metadata?: string | null | undefined;
    description?: string | null | undefined;
    category?: TemplateCategory | undefined;
    content?: string | null | undefined;
    isActive?: boolean | undefined;
    documentId?: string | null | undefined;
}>;
export declare const TemplateQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodNativeEnum<typeof TemplateCategory>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["name", "category", "created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "name" | "created_at" | "updated_at" | "category";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    category?: TemplateCategory | undefined;
    isActive?: boolean | undefined;
}, {
    search?: string | undefined;
    category?: TemplateCategory | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "name" | "created_at" | "updated_at" | "category" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    isActive?: boolean | undefined;
}>;
export type UploadDocumentMetadataDto = z.infer<typeof UploadDocumentMetadataSchema>;
export type UploadVersionMetadataDto = z.infer<typeof UploadVersionMetadataSchema>;
export type CreateTemplateRequestDto = z.infer<typeof CreateTemplateRequestSchema>;
export type UpdateTemplateRequestDto = z.infer<typeof UpdateTemplateRequestSchema>;
export type TemplateQueryDto = z.infer<typeof TemplateQuerySchema>;
//# sourceMappingURL=document.request.dto.d.ts.map