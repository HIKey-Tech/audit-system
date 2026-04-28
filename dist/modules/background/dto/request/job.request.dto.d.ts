import { z } from 'zod';
export declare const JobIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type JobIdParamsDto = z.infer<typeof JobIdParamsSchema>;
export declare const JobRunHistoryQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["running", "success", "failure"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortOrder: "asc" | "desc";
    status?: "success" | "failure" | "running" | undefined;
}, {
    status?: "success" | "failure" | "running" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type JobRunHistoryQueryDto = z.infer<typeof JobRunHistoryQuerySchema>;
//# sourceMappingURL=job.request.dto.d.ts.map