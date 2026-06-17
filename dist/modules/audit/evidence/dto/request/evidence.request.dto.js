"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeEvidenceRequestSchema = exports.EvidenceRepositoryQuerySchema = exports.EvidenceQuerySchema = exports.UploadEvidenceMetadataSchema = void 0;
const zod_1 = require("zod");
exports.UploadEvidenceMetadataSchema = zod_1.z.object({
    workingPaperId: zod_1.z.string().uuid().optional(),
    findingId: zod_1.z.string().uuid().optional(),
});
exports.EvidenceQuerySchema = zod_1.z.object({
    workingPaperId: zod_1.z.string().uuid().optional(),
    findingId: zod_1.z.string().uuid().optional(),
});
/**
 * Centralized evidence repository query — a cross-engagement view over all
 * audit evidence. Values arrive as query-string strings, so numbers/booleans/
 * dates are coerced. Pagination keys (page/pageSize) are consumed by
 * parsePagination in the service.
 */
exports.EvidenceRepositoryQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional(),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
    engagementId: zod_1.z.string().uuid().optional(),
    findingId: zod_1.z.string().uuid().optional(),
    workingPaperId: zod_1.z.string().uuid().optional(),
    uploadedById: zod_1.z.string().uuid().optional(),
    fileType: zod_1.z.string().min(1).max(100).optional(),
    isDisputed: zod_1.z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
    uploadedFrom: zod_1.z.coerce.date().optional(),
    uploadedTo: zod_1.z.coerce.date().optional(),
});
exports.DisputeEvidenceRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
//# sourceMappingURL=evidence.request.dto.js.map