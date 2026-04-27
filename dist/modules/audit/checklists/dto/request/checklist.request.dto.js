"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateChecklistItemRequestSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
exports.UpdateChecklistItemRequestSchema = zod_1.z.object({
    result: zod_1.z.nativeEnum(audit_enum_1.ChecklistResult),
    notes: zod_1.z.string().max(5000).nullable().optional(),
});
//# sourceMappingURL=checklist.request.dto.js.map