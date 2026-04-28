"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyAssignmentsQuerySchema = exports.AssignStaffRequestSchema = void 0;
const zod_1 = require("zod");
const workflow_enum_1 = require("../../../domain/enum/workflow.enum");
exports.AssignStaffRequestSchema = zod_1.z.object({
    engagementId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    role: zod_1.z.nativeEnum(workflow_enum_1.WorkflowAssignmentRole),
});
exports.MyAssignmentsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.string().optional(),
});
//# sourceMappingURL=assignment.request.dto.js.map