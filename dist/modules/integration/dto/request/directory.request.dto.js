"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMappingSchema = exports.CreateMappingSchema = void 0;
const zod_1 = require("zod");
exports.CreateMappingSchema = zod_1.z.object({
    adGroupId: zod_1.z.string().uuid('adGroupId must be the group Object ID (GUID)'),
    adGroupName: zod_1.z.string().min(1).max(256),
    roleId: zod_1.z.string().uuid(),
});
exports.UpdateMappingSchema = zod_1.z.object({
    adGroupName: zod_1.z.string().min(1).max(256).optional(),
    roleId: zod_1.z.string().uuid().optional(),
    isActive: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=directory.request.dto.js.map