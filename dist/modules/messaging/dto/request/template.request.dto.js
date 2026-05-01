"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateQuerySchema = exports.UpdateTemplateRequestSchema = exports.CreateTemplateRequestSchema = void 0;
// src/modules/messaging/dto/request/template.request.dto.ts
const zod_1 = require("zod");
const template_enum_1 = require("../../domain/enum/template.enum");
exports.CreateTemplateRequestSchema = zod_1.z.object({
    eventKey: zod_1.z.string().min(1).max(200),
    channel: zod_1.z.enum(template_enum_1.NOTIFICATION_TEMPLATE_CHANNELS),
    name: zod_1.z.string().min(1).max(200),
    subject: zod_1.z.string().max(500).optional(),
    body: zod_1.z.string().min(1),
    description: zod_1.z.string().max(1000).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.UpdateTemplateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    subject: zod_1.z.string().max(500).optional(),
    body: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().max(1000).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.TemplateQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    channel: zod_1.z.enum(template_enum_1.NOTIFICATION_TEMPLATE_CHANNELS).optional(),
    eventKey: zod_1.z.string().min(1).max(200).optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
    sortBy: zod_1.z.enum(['event_key', 'channel', 'name', 'created_at', 'updated_at']).default('event_key'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
//# sourceMappingURL=template.request.dto.js.map