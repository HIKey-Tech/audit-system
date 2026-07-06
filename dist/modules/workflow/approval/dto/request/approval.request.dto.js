"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingApprovalQuerySchema = exports.ApprovalEntityParamsSchema = exports.RejectApprovalRequestSchema = exports.ApprovalActionRequestSchema = exports.ApprovalEditsSchema = exports.CreateApprovalRequestSchema = void 0;
const zod_1 = require("zod");
const workflow_enum_1 = require("../../../domain/enum/workflow.enum");
exports.CreateApprovalRequestSchema = zod_1.z.object({
    entityType: zod_1.z.nativeEnum(workflow_enum_1.WorkflowEntityType),
    entityId: zod_1.z.string().uuid(),
});
// "Approve with edit": lets the current approver fix a small issue (e.g. a
// typo) themselves at the moment of approval instead of rejecting and forcing
// a full resubmission back through level 1. AuditReport accepts the three
// report body fields; AuditWorkingPaper accepts `content` (the paper's full
// serialized content, as edited in the approve panel).
exports.ApprovalEditsSchema = zod_1.z.object({
    executiveSummary: zod_1.z.string().min(1).optional(),
    scope: zod_1.z.string().min(1).optional(),
    methodology: zod_1.z.string().min(1).optional(),
    content: zod_1.z.string().min(1).optional(),
}).partial();
exports.ApprovalActionRequestSchema = zod_1.z.object({
    comment: zod_1.z.string().max(5000).optional(),
    edits: exports.ApprovalEditsSchema.optional(),
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