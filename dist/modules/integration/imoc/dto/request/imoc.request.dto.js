"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImocSyncRequestSchema = exports.ImocModelLookupSchema = exports.ImocTicketLookupRequestSchema = exports.LinkImocTicketSchema = exports.SearchImocTicketsSchema = void 0;
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
//# sourceMappingURL=imoc.request.dto.js.map