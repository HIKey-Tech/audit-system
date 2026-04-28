"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertEscalationPolicyRequestSchema = exports.EscalationPolicyQuerySchema = exports.EscalationEntityParamsSchema = void 0;
const zod_1 = require("zod");
const workflow_enum_1 = require("../../../domain/enum/workflow.enum");
exports.EscalationEntityParamsSchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(workflow_enum_1.WorkflowEscalationEntityType),
    id: zod_1.z.string().uuid(),
});
exports.EscalationPolicyQuerySchema = zod_1.z.object({
    auditType: zod_1.z.nativeEnum(workflow_enum_1.EscalationPolicyAuditType).default(workflow_enum_1.EscalationPolicyAuditType.All),
});
exports.UpsertEscalationPolicyRequestSchema = zod_1.z.object({
    auditType: zod_1.z.nativeEnum(workflow_enum_1.EscalationPolicyAuditType),
    level1Hours: zod_1.z.coerce.number().int().positive().default(24),
    level2Hours: zod_1.z.coerce.number().int().positive().default(72),
    level3Hours: zod_1.z.coerce.number().int().positive().default(120),
    level4Hours: zod_1.z.coerce.number().int().positive().default(168),
    isActive: zod_1.z.boolean().default(true),
});
//# sourceMappingURL=escalation.request.dto.js.map