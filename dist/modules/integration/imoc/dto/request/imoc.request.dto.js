"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTicketRiskLinkSchema = exports.UpdateSavedViewSchema = exports.CreateSavedViewSchema = exports.ListStoredTicketsQuerySchema = exports.PreviewImocRuleSchema = exports.UpdateImocRuleSchema = exports.CreateImocRuleSchema = exports.ImocSyncRequestSchema = exports.ImocModelLookupSchema = exports.ImocTicketLookupRequestSchema = exports.LinkImocTicketSchema = exports.SearchImocTicketsSchema = void 0;
const zod_1 = require("zod");
const ImocTicketLookupSchema = zod_1.z
    .object({
    orderId: zod_1.z.string().trim().min(1).max(200).optional(),
    orderNumber: zod_1.z.string().trim().min(1).max(200).optional(),
})
    .refine((value) => Boolean(value.orderId || value.orderNumber), {
    message: 'Provide an IMOC ticket ID or ticket number.',
});
exports.SearchImocTicketsSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    orderStatus: zod_1.z.string().trim().max(100).optional(),
    modelId: zod_1.z.string().trim().max(200).optional(),
    modelName: zod_1.z.string().trim().max(200).optional(),
    orderNumber: zod_1.z.string().trim().max(500).optional(),
    orderName: zod_1.z.string().trim().max(500).optional(),
    currentUser: zod_1.z.string().trim().max(200).optional(),
    slaStatus: zod_1.z.string().trim().max(100).optional(),
    beginStartDate: zod_1.z.string().trim().max(40).optional(),
    beginEndDate: zod_1.z.string().trim().max(40).optional(),
    endStartDate: zod_1.z.string().trim().max(40).optional(),
    endEndDate: zod_1.z.string().trim().max(40).optional(),
});
exports.LinkImocTicketSchema = ImocTicketLookupSchema;
exports.ImocTicketLookupRequestSchema = ImocTicketLookupSchema;
exports.ImocModelLookupSchema = zod_1.z.object({ modelId: zod_1.z.string().trim().min(1).max(200) });
exports.ImocSyncRequestSchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().positive().max(100).default(25),
});
// ---------------------------------------------------------------------------
// Ingestion Rules & Runs DTOs
// ---------------------------------------------------------------------------
exports.CreateImocRuleSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(150),
    description: zod_1.z.string().trim().max(500).optional(),
    isActive: zod_1.z.boolean().default(true),
    priority: zod_1.z.coerce.number().int().min(1).max(1000).default(100),
    criteria: zod_1.z.record(zod_1.z.unknown()), // Will be strictly validated via validateRuleCriteria
    category: zod_1.z.string().trim().max(100).optional(),
    riskCategoryId: zod_1.z.string().uuid().optional(),
    lookbackDays: zod_1.z.coerce.number().int().min(1).max(365).default(30),
});
exports.UpdateImocRuleSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(150).optional(),
    description: zod_1.z.string().trim().max(500).optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
    priority: zod_1.z.coerce.number().int().min(1).max(1000).optional(),
    criteria: zod_1.z.record(zod_1.z.unknown()).optional(),
    category: zod_1.z.string().trim().max(100).optional().nullable(),
    riskCategoryId: zod_1.z.string().uuid().optional().nullable(),
    lookbackDays: zod_1.z.coerce.number().int().min(1).max(365).optional(),
});
exports.PreviewImocRuleSchema = zod_1.z.object({
    criteria: zod_1.z.record(zod_1.z.unknown()),
    lookbackDays: zod_1.z.coerce.number().int().min(1).max(365).default(30),
});
// ---------------------------------------------------------------------------
// Stored Tickets Query & Export DTOs
// ---------------------------------------------------------------------------
exports.ListStoredTicketsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    slaStatus: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    category: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    modelId: zod_1.z.string().trim().optional(),
    search: zod_1.z.string().trim().optional(),
    createdFrom: zod_1.z.string().trim().optional(),
    createdTo: zod_1.z.string().trim().optional(),
    handler: zod_1.z.string().trim().optional(),
    sort: zod_1.z
        .enum(['orderNumber', 'imocCreatedAt', 'orderStatus', 'slaStatus', 'category', 'lastSyncedAt'])
        .default('imocCreatedAt'),
    order: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
// ---------------------------------------------------------------------------
// Saved Views DTOs
// ---------------------------------------------------------------------------
exports.CreateSavedViewSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(100),
    filters: zod_1.z.record(zod_1.z.unknown()),
    isDefault: zod_1.z.boolean().default(false),
});
exports.UpdateSavedViewSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(100).optional(),
    filters: zod_1.z.record(zod_1.z.unknown()).optional(),
    isDefault: zod_1.z.boolean().optional(),
});
// ---------------------------------------------------------------------------
// Risk Link DTOs
// ---------------------------------------------------------------------------
exports.CreateTicketRiskLinkSchema = zod_1.z.object({
    imocTicketId: zod_1.z.string().uuid(),
    riskId: zod_1.z.string().uuid().optional(),
    createRisk: zod_1.z
        .object({
        title: zod_1.z.string().trim().min(1).max(200),
        description: zod_1.z.string().trim().min(1),
        categoryId: zod_1.z.string().uuid(),
        likelihood: zod_1.z.coerce.number().int().min(1).max(5).default(3),
        impact: zod_1.z.coerce.number().int().min(1).max(5).default(3),
        businessObjective: zod_1.z.string().trim().max(500).optional(),
    })
        .optional(),
    notes: zod_1.z.string().trim().optional(),
});
//# sourceMappingURL=imoc.request.dto.js.map