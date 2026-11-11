"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkProjectPlusEntitySchema = exports.ListProjectPlusEntitiesQuerySchema = void 0;
const zod_1 = require("zod");
exports.ListProjectPlusEntitiesQuerySchema = zod_1.z.object({
    customerType: zod_1.z
        .string()
        .trim()
        .min(1)
        .max(50)
        .regex(/^[A-Za-z0-9 _-]+$/, 'customerType may contain letters, numbers, spaces, hyphens and underscores only'),
    search: zod_1.z.string().trim().max(100).optional(),
    status: zod_1.z.string().trim().max(50).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(25),
});
exports.LinkProjectPlusEntitySchema = zod_1.z.object({
    customerType: exports.ListProjectPlusEntitiesQuerySchema.shape.customerType,
    referenceCode: zod_1.z.string().trim().min(1).max(100),
});
//# sourceMappingURL=projectplus.request.dto.js.map