import { z } from 'zod';
export declare const CreateTemplateRequestSchema: z.ZodObject<{
    eventKey: z.ZodString;
    channel: z.ZodEnum<["email", "in_app"]>;
    name: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    body: string;
    channel: "email" | "in_app";
    eventKey: string;
    description?: string | undefined;
    subject?: string | undefined;
    isActive?: boolean | undefined;
}, {
    name: string;
    body: string;
    channel: "email" | "in_app";
    eventKey: string;
    description?: string | undefined;
    subject?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const UpdateTemplateRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    body?: string | undefined;
    description?: string | undefined;
    subject?: string | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    body?: string | undefined;
    description?: string | undefined;
    subject?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const TemplateQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    channel: z.ZodOptional<z.ZodEnum<["email", "in_app"]>>;
    eventKey: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["event_key", "channel", "name", "created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "name" | "created_at" | "updated_at" | "channel" | "event_key";
    sortOrder: "asc" | "desc";
    channel?: "email" | "in_app" | undefined;
    isActive?: boolean | undefined;
    eventKey?: string | undefined;
}, {
    channel?: "email" | "in_app" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "name" | "created_at" | "updated_at" | "channel" | "event_key" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    isActive?: boolean | undefined;
    eventKey?: string | undefined;
}>;
export type CreateTemplateRequestDto = z.infer<typeof CreateTemplateRequestSchema>;
export type UpdateTemplateRequestDto = z.infer<typeof UpdateTemplateRequestSchema>;
export type TemplateQueryDto = z.infer<typeof TemplateQuerySchema>;
//# sourceMappingURL=template.request.dto.d.ts.map