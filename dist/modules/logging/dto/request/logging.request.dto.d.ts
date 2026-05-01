import { z } from 'zod';
export declare const AuditLogListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    userId: z.ZodOptional<z.ZodString>;
    module: z.ZodOptional<z.ZodString>;
    entityType: z.ZodOptional<z.ZodString>;
    entityId: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["success", "failure"]>>;
    dateFrom: z.ZodOptional<z.ZodDate>;
    dateTo: z.ZodOptional<z.ZodDate>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "createdAt";
    sortOrder: "asc" | "desc";
    action?: string | undefined;
    module?: string | undefined;
    status?: "success" | "failure" | undefined;
    userId?: string | undefined;
    entityType?: string | undefined;
    entityId?: string | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
}, {
    action?: string | undefined;
    module?: string | undefined;
    status?: "success" | "failure" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    userId?: string | undefined;
    entityType?: string | undefined;
    entityId?: string | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
    sortBy?: "createdAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const AuditLogIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const AuditLogSummaryQuerySchema: z.ZodObject<{
    dateFrom: z.ZodOptional<z.ZodDate>;
    dateTo: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
}, {
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
}>;
export type AuditLogListQueryDto = z.infer<typeof AuditLogListQuerySchema>;
export type AuditLogIdParamsDto = z.infer<typeof AuditLogIdParamsSchema>;
export type AuditLogSummaryQueryDto = z.infer<typeof AuditLogSummaryQuerySchema>;
//# sourceMappingURL=logging.request.dto.d.ts.map