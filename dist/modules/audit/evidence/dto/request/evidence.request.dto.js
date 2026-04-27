"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeEvidenceRequestSchema = exports.EvidenceQuerySchema = exports.UploadEvidenceMetadataSchema = void 0;
const zod_1 = require("zod");
exports.UploadEvidenceMetadataSchema = zod_1.z.object({
    workingPaperId: zod_1.z.string().uuid().optional(),
    findingId: zod_1.z.string().uuid().optional(),
});
exports.EvidenceQuerySchema = zod_1.z.object({
    workingPaperId: zod_1.z.string().uuid().optional(),
    findingId: zod_1.z.string().uuid().optional(),
});
exports.DisputeEvidenceRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
//# sourceMappingURL=evidence.request.dto.js.map