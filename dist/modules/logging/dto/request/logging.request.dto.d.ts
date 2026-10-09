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
    /** Only entries that recorded a data change (old/new values) — the change history view. */
    hasChanges: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
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
    hasChanges?: boolean | undefined;
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
    hasChanges?: "true" | "false" | undefined;
    sortBy?: "createdAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const AuditLogExportQuerySchema: z.ZodObject<Omit<{
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
    /** Only entries that recorded a data change (old/new values) — the change history view. */
    hasChanges: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "page" | "pageSize"> & {
    format: z.ZodDefault<z.ZodEnum<["csv", "xlsx"]>>;
}, "strip", z.ZodTypeAny, {
    format: "csv" | "xlsx";
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
    hasChanges?: boolean | undefined;
}, {
    format?: "csv" | "xlsx" | undefined;
    action?: string | undefined;
    module?: string | undefined;
    status?: "success" | "failure" | undefined;
    userId?: string | undefined;
    entityType?: string | undefined;
    entityId?: string | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
    hasChanges?: "true" | "false" | undefined;
    sortBy?: "createdAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const SecuritySummaryQuerySchema: z.ZodObject<{
    days: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    days: number;
}, {
    days?: number | undefined;
}>;
export declare const SystemLogListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    source: z.ZodOptional<z.ZodEnum<["http", "job", "app"]>>;
    search: z.ZodOptional<z.ZodString>;
    dateFrom: z.ZodOptional<z.ZodDate>;
    dateTo: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
    source?: "http" | "job" | "app" | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
}, {
    search?: string | undefined;
    source?: "http" | "job" | "app" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
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
export type AuditLogExportQueryDto = z.infer<typeof AuditLogExportQuerySchema>;
export type SecuritySummaryQueryDto = z.infer<typeof SecuritySummaryQuerySchema>;
export type SystemLogListQueryDto = z.infer<typeof SystemLogListQuerySchema>;
//# sourceMappingURL=logging.request.dto.d.ts.map