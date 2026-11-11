import { z } from 'zod';
export declare const ListProjectPlusEntitiesQuerySchema: z.ZodObject<{
    customerType: z.ZodString;
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    customerType: string;
    search?: string | undefined;
    status?: string | undefined;
}, {
    customerType: string;
    search?: string | undefined;
    status?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type ListProjectPlusEntitiesQuery = z.infer<typeof ListProjectPlusEntitiesQuerySchema>;
export declare const LinkProjectPlusEntitySchema: z.ZodObject<{
    customerType: z.ZodString;
    referenceCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    customerType: string;
    referenceCode: string;
}, {
    customerType: string;
    referenceCode: string;
}>;
export type LinkProjectPlusEntityDto = z.infer<typeof LinkProjectPlusEntitySchema>;
//# sourceMappingURL=projectplus.request.dto.d.ts.map