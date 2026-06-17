"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryQuerySchema = void 0;
const zod_1 = require("zod");
/**
 * Centralized audit repository query. `category` is the dropdown filter:
 *   - audit_record       → issued reports + signed-off working-paper snapshots
 *   - supporting_document → working-paper source material
 *   - evidence           → engagement + follow-up evidence files
 *   - all (or omitted)   → everything audit-related
 */
exports.RepositoryQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional(),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
    category: zod_1.z.enum(['audit_record', 'supporting_document', 'evidence', 'all']).optional(),
});
//# sourceMappingURL=repository.request.dto.js.map