"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RejectWorkingPaperRequestSchema = exports.UpdateWorkingPaperRequestSchema = exports.CreateWorkingPaperRequestSchema = void 0;
const zod_1 = require("zod");
exports.CreateWorkingPaperRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    content: zod_1.z.string().min(1),
});
exports.UpdateWorkingPaperRequestSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    content: zod_1.z.string().min(1).optional(),
});
exports.RejectWorkingPaperRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
//# sourceMappingURL=working-paper.request.dto.js.map