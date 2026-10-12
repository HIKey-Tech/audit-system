import { z } from 'zod';
export declare const SearchImocTicketsSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    orderStatus: z.ZodOptional<z.ZodString>;
    modelId: z.ZodOptional<z.ZodString>;
    modelName: z.ZodOptional<z.ZodString>;
    orderNumber: z.ZodOptional<z.ZodString>;
    orderName: z.ZodOptional<z.ZodString>;
    currentUser: z.ZodOptional<z.ZodString>;
    slaStatus: z.ZodOptional<z.ZodString>;
    beginStartDate: z.ZodOptional<z.ZodString>;
    beginEndDate: z.ZodOptional<z.ZodString>;
    endStartDate: z.ZodOptional<z.ZodString>;
    endEndDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    orderNumber?: string | undefined;
    orderStatus?: string | undefined;
    modelId?: string | undefined;
    modelName?: string | undefined;
    orderName?: string | undefined;
    currentUser?: string | undefined;
    slaStatus?: string | undefined;
    beginStartDate?: string | undefined;
    beginEndDate?: string | undefined;
    endStartDate?: string | undefined;
    endEndDate?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    orderNumber?: string | undefined;
    orderStatus?: string | undefined;
    modelId?: string | undefined;
    modelName?: string | undefined;
    orderName?: string | undefined;
    currentUser?: string | undefined;
    slaStatus?: string | undefined;
    beginStartDate?: string | undefined;
    beginEndDate?: string | undefined;
    endStartDate?: string | undefined;
    endEndDate?: string | undefined;
}>;
export declare const LinkImocTicketSchema: z.ZodEffects<z.ZodObject<{
    orderId: z.ZodOptional<z.ZodString>;
    orderNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orderId?: string | undefined;
    orderNumber?: string | undefined;
}, {
    orderId?: string | undefined;
    orderNumber?: string | undefined;
}>, {
    orderId?: string | undefined;
    orderNumber?: string | undefined;
}, {
    orderId?: string | undefined;
    orderNumber?: string | undefined;
}>;
export declare const ImocTicketLookupRequestSchema: z.ZodEffects<z.ZodObject<{
    orderId: z.ZodOptional<z.ZodString>;
    orderNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orderId?: string | undefined;
    orderNumber?: string | undefined;
}, {
    orderId?: string | undefined;
    orderNumber?: string | undefined;
}>, {
    orderId?: string | undefined;
    orderNumber?: string | undefined;
}, {
    orderId?: string | undefined;
    orderNumber?: string | undefined;
}>;
export declare const ImocModelLookupSchema: z.ZodObject<{
    modelId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    modelId: string;
}, {
    modelId: string;
}>;
export declare const ImocSyncRequestSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
}, {
    limit?: number | undefined;
}>;
export type SearchImocTicketsDto = z.infer<typeof SearchImocTicketsSchema>;
export type LinkImocTicketDto = z.infer<typeof LinkImocTicketSchema>;
export type ImocTicketLookupRequestDto = z.infer<typeof ImocTicketLookupRequestSchema>;
export type ImocModelLookupDto = z.infer<typeof ImocModelLookupSchema>;
export type ImocSyncRequestDto = z.infer<typeof ImocSyncRequestSchema>;
export declare const CreateImocRuleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    priority: z.ZodDefault<z.ZodNumber>;
    criteria: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    category: z.ZodOptional<z.ZodString>;
    riskCategoryId: z.ZodOptional<z.ZodString>;
    lookbackDays: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    priority: number;
    isActive: boolean;
    criteria: Record<string, unknown>;
    lookbackDays: number;
    description?: string | undefined;
    category?: string | undefined;
    riskCategoryId?: string | undefined;
}, {
    name: string;
    criteria: Record<string, unknown>;
    description?: string | undefined;
    category?: string | undefined;
    priority?: number | undefined;
    isActive?: boolean | undefined;
    riskCategoryId?: string | undefined;
    lookbackDays?: number | undefined;
}>;
export declare const UpdateImocRuleSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    priority: z.ZodOptional<z.ZodNumber>;
    criteria: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    riskCategoryId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    lookbackDays: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    category?: string | null | undefined;
    priority?: number | undefined;
    isActive?: boolean | undefined;
    criteria?: Record<string, unknown> | undefined;
    riskCategoryId?: string | null | undefined;
    lookbackDays?: number | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    category?: string | null | undefined;
    priority?: number | undefined;
    isActive?: boolean | undefined;
    criteria?: Record<string, unknown> | undefined;
    riskCategoryId?: string | null | undefined;
    lookbackDays?: number | undefined;
}>;
export declare const PreviewImocRuleSchema: z.ZodObject<{
    criteria: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    lookbackDays: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    criteria: Record<string, unknown>;
    lookbackDays: number;
}, {
    criteria: Record<string, unknown>;
    lookbackDays?: number | undefined;
}>;
export declare const ListStoredTicketsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
    slaStatus: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
    category: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
    modelId: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    createdFrom: z.ZodOptional<z.ZodString>;
    createdTo: z.ZodOptional<z.ZodString>;
    handler: z.ZodOptional<z.ZodString>;
    sort: z.ZodDefault<z.ZodEnum<["orderNumber", "imocCreatedAt", "orderStatus", "slaStatus", "category", "lastSyncedAt"]>>;
    order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    sort: "category" | "lastSyncedAt" | "orderNumber" | "orderStatus" | "slaStatus" | "imocCreatedAt";
    page: number;
    pageSize: number;
    order: "asc" | "desc";
    search?: string | undefined;
    status?: string | string[] | undefined;
    category?: string | string[] | undefined;
    modelId?: string | undefined;
    slaStatus?: string | string[] | undefined;
    createdFrom?: string | undefined;
    createdTo?: string | undefined;
    handler?: string | undefined;
}, {
    sort?: "category" | "lastSyncedAt" | "orderNumber" | "orderStatus" | "slaStatus" | "imocCreatedAt" | undefined;
    search?: string | undefined;
    status?: string | string[] | undefined;
    category?: string | string[] | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    modelId?: string | undefined;
    slaStatus?: string | string[] | undefined;
    createdFrom?: string | undefined;
    createdTo?: string | undefined;
    handler?: string | undefined;
    order?: "asc" | "desc" | undefined;
}>;
export declare const CreateSavedViewSchema: z.ZodObject<{
    name: z.ZodString;
    filters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isDefault: boolean;
    filters: Record<string, unknown>;
}, {
    name: string;
    filters: Record<string, unknown>;
    isDefault?: boolean | undefined;
}>;
export declare const UpdateSavedViewSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isDefault?: boolean | undefined;
    filters?: Record<string, unknown> | undefined;
}, {
    name?: string | undefined;
    isDefault?: boolean | undefined;
    filters?: Record<string, unknown> | undefined;
}>;
export declare const CreateTicketRiskLinkSchema: z.ZodObject<{
    imocTicketId: z.ZodString;
    riskId: z.ZodOptional<z.ZodString>;
    createRisk: z.ZodOptional<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        categoryId: z.ZodString;
        likelihood: z.ZodDefault<z.ZodNumber>;
        impact: z.ZodDefault<z.ZodNumber>;
        businessObjective: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description: string;
        likelihood: number;
        impact: number;
        categoryId: string;
        businessObjective?: string | undefined;
    }, {
        title: string;
        description: string;
        categoryId: string;
        likelihood?: number | undefined;
        impact?: number | undefined;
        businessObjective?: string | undefined;
    }>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    imocTicketId: string;
    notes?: string | undefined;
    riskId?: string | undefined;
    createRisk?: {
        title: string;
        description: string;
        likelihood: number;
        impact: number;
        categoryId: string;
        businessObjective?: string | undefined;
    } | undefined;
}, {
    imocTicketId: string;
    notes?: string | undefined;
    riskId?: string | undefined;
    createRisk?: {
        title: string;
        description: string;
        categoryId: string;
        likelihood?: number | undefined;
        impact?: number | undefined;
        businessObjective?: string | undefined;
    } | undefined;
}>;
export type CreateImocRuleDto = z.infer<typeof CreateImocRuleSchema>;
export type UpdateImocRuleDto = z.infer<typeof UpdateImocRuleSchema>;
export type PreviewImocRuleDto = z.infer<typeof PreviewImocRuleSchema>;
export type ListStoredTicketsQueryDto = z.infer<typeof ListStoredTicketsQuerySchema>;
export type CreateSavedViewDto = z.infer<typeof CreateSavedViewSchema>;
export type UpdateSavedViewDto = z.infer<typeof UpdateSavedViewSchema>;
export type CreateTicketRiskLinkDto = z.infer<typeof CreateTicketRiskLinkSchema>;
//# sourceMappingURL=imoc.request.dto.d.ts.map