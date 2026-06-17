import { z } from 'zod';

/**
 * Centralized audit repository query. `category` is the dropdown filter:
 *   - audit_record       → issued reports + signed-off working-paper snapshots
 *   - supporting_document → working-paper source material
 *   - evidence           → engagement + follow-up evidence files
 *   - all (or omitted)   → everything audit-related
 */
export const RepositoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  category: z.enum(['audit_record', 'supporting_document', 'evidence', 'all']).optional(),
});

export type RepositoryQueryDto = z.infer<typeof RepositoryQuerySchema>;
