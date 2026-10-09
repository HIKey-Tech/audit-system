"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessItemExportQuerySchema = exports.DecideAccessItemsSchema = exports.AccessItemListQuerySchema = void 0;
const zod_1 = require("zod");
const tabular_export_util_1 = require("../../../../../shared/utils/tabular-export.util");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
const QueryBooleanSchema = zod_1.z.enum(['true', 'false']).transform((v) => v === 'true');
exports.AccessItemListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(200).default(50),
    decision: zod_1.z.nativeEnum(system_audit_enum_1.AccessDecision).optional(),
    /** Only accounts an analysis rule raised something against. */
    flagged: QueryBooleanSchema.optional(),
    privileged: QueryBooleanSchema.optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
});
exports.DecideAccessItemsSchema = zod_1.z
    .object({
    itemIds: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(500),
    decision: zod_1.z.nativeEnum(system_audit_enum_1.AccessDecision),
    note: zod_1.z.string().trim().max(4000).optional(),
})
    .refine((d) => ![system_audit_enum_1.AccessDecision.Revoke, system_audit_enum_1.AccessDecision.Modify].includes(d.decision) || Boolean(d.note), { message: 'Say what access should be removed or changed', path: ['note'] });
exports.AccessItemExportQuerySchema = zod_1.z.object({ format: tabular_export_util_1.ExportFormatSchema });
//# sourceMappingURL=access-review.request.dto.js.map