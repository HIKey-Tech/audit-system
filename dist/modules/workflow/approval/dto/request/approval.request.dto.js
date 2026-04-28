"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingApprovalQuerySchema = exports.ApprovalEntityParamsSchema = exports.RejectApprovalRequestSchema = exports.ApprovalActionRequestSchema = exports.CreateApprovalRequestSchema = void 0;
const zod_1 = require("zod");
const workflow_enum_1 = require("../../../domain/enum/workflow.enum");
exports.CreateApprovalRequestSchema = zod_1.z.object({
    entityType: zod_1.z.nativeEnum(workflow_enum_1.WorkflowEntityType),
    entityId: zod_1.z.string().uuid(),
});
exports.ApprovalActionRequestSchema = zod_1.z.object({
    comment: zod_1.z.string().max(5000).optional(),
});
exports.RejectApprovalRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(5000),
});
exports.ApprovalEntityParamsSchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(workflow_enum_1.WorkflowEntityType),
    id: zod_1.z.string().uuid(),
});
exports.PendingApprovalQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
//# sourceMappingURL=approval.request.dto.js.map