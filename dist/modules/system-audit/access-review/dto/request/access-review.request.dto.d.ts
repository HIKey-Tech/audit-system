import { z } from 'zod';
import { AccessDecision } from '../../../domain/enum/system-audit.enum';
export declare const AccessItemListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    decision: z.ZodOptional<z.ZodNativeEnum<typeof AccessDecision>>;
    /** Only accounts an analysis rule raised something against. */
    flagged: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
    privileged: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
    decision?: AccessDecision | undefined;
    privileged?: boolean | undefined;
    flagged?: boolean | undefined;
}, {
    search?: string | undefined;
    decision?: AccessDecision | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    privileged?: "true" | "false" | undefined;
    flagged?: "true" | "false" | undefined;
}>;
export declare const DecideAccessItemsSchema: z.ZodEffects<z.ZodObject<{
    itemIds: z.ZodArray<z.ZodString, "many">;
    decision: z.ZodNativeEnum<typeof AccessDecision>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: AccessDecision;
    itemIds: string[];
    note?: string | undefined;
}, {
    decision: AccessDecision;
    itemIds: string[];
    note?: string | undefined;
}>, {
    decision: AccessDecision;
    itemIds: string[];
    note?: string | undefined;
}, {
    decision: AccessDecision;
    itemIds: string[];
    note?: string | undefined;
}>;
export declare const AccessItemExportQuerySchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodEnum<["csv", "xlsx"]>>;
}, "strip", z.ZodTypeAny, {
    format: "csv" | "xlsx";
}, {
    format?: "csv" | "xlsx" | undefined;
}>;
export type AccessItemListQueryDto = z.infer<typeof AccessItemListQuerySchema>;
export type DecideAccessItemsDto = z.infer<typeof DecideAccessItemsSchema>;
export type AccessItemExportQueryDto = z.infer<typeof AccessItemExportQuerySchema>;
//# sourceMappingURL=access-review.request.dto.d.ts.map