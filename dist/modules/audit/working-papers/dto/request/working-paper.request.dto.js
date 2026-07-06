"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddWorkingPaperCommentSchema = exports.ApproveWorkingPaperRequestSchema = exports.RejectWorkingPaperRequestSchema = exports.ImportWorkingPaperMetadataSchema = exports.UpdateWorkingPaperRequestSchema = exports.CreateWorkingPaperRequestSchema = void 0;
const zod_1 = require("zod");
exports.CreateWorkingPaperRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    content: zod_1.z.string().min(1),
    templateId: zod_1.z.string().uuid().optional(),
    sourceDocumentId: zod_1.z.string().uuid().optional(),
    workingPaperType: zod_1.z.string().min(1).max(100).optional(),
    importMetadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.UpdateWorkingPaperRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    content: zod_1.z.string().min(1).optional(),
});
exports.ImportWorkingPaperMetadataSchema = zod_1.z.object({
    templateId: zod_1.z.string().uuid().optional(),
    workingPaperType: zod_1.z.string().min(1).max(100).optional(),
});
exports.RejectWorkingPaperRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
exports.ApproveWorkingPaperRequestSchema = zod_1.z.object({
    // Approve-with-edit: full serialized paper content as fixed by the approver.
    edits: zod_1.z.object({ content: zod_1.z.string().min(1) }).optional(),
});
exports.AddWorkingPaperCommentSchema = zod_1.z.object({
    body: zod_1.z.string().min(1).max(5000),
});
//# sourceMappingURL=working-paper.request.dto.js.map