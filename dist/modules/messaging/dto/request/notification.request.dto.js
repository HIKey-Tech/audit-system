"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationQuerySchema = void 0;
// src/modules/messaging/dto/request/notification.request.dto.ts
const zod_1 = require("zod");
exports.NotificationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    isRead: zod_1.z.coerce.boolean().optional(),
    sortBy: zod_1.z.enum(['created_at', 'read_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=notification.request.dto.js.map