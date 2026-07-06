"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReturnEvidenceRequestSchema = exports.CreateEvidenceRequestSchema = void 0;
const zod_1 = require("zod");
exports.CreateEvidenceRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(200),
    description: zod_1.z.string().max(4000).optional(),
    dueDate: zod_1.z.coerce.date().optional(),
    /** Defaults to the engagement's auditee when omitted. */
    assignedToId: zod_1.z.string().uuid().optional(),
});
exports.ReturnEvidenceRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3).max(2000),
});
//# sourceMappingURL=evidence-request.request.dto.js.map