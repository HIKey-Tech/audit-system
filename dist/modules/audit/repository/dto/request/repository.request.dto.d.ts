import { z } from 'zod';
/**
 * Centralized audit repository query. `category` is the dropdown filter:
 *   - audit_record       → issued reports + signed-off working-paper snapshots
 *   - supporting_document → working-paper source material
 *   - evidence           → engagement + follow-up evidence files
 *   - all (or omitted)   → everything audit-related
 */
export declare const RepositoryQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["audit_record", "supporting_document", "evidence", "all"]>>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    category?: "evidence" | "all" | "audit_record" | "supporting_document" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    search?: string | undefined;
    category?: "evidence" | "all" | "audit_record" | "supporting_document" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type RepositoryQueryDto = z.infer<typeof RepositoryQuerySchema>;
//# sourceMappingURL=repository.request.dto.d.ts.map