import { z } from 'zod';
export declare const NotificationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    isRead: z.ZodOptional<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["created_at", "read_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "created_at" | "read_at";
    sortOrder: "asc" | "desc";
    isRead?: boolean | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "created_at" | "read_at" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    isRead?: boolean | undefined;
}>;
export type NotificationQueryDto = z.infer<typeof NotificationQuerySchema>;
//# sourceMappingURL=notification.request.dto.d.ts.map