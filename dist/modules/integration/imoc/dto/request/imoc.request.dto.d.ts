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
//# sourceMappingURL=imoc.request.dto.d.ts.map