import { z } from 'zod';
export declare const ActivityQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
}, {
    limit?: number | undefined;
}>;
export type ActivityQueryDto = z.infer<typeof ActivityQuerySchema>;
//# sourceMappingURL=dashboard.request.dto.d.ts.map