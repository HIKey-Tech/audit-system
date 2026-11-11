"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniverseQuerySchema = exports.UpdateUniverseRequestSchema = exports.CreateUniverseRequestSchema = void 0;
const zod_1 = require("zod");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
exports.CreateUniverseRequestSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(5000).optional(),
    category: zod_1.z.nativeEnum(audit_enum_1.UniverseCategory),
    ownerId: zod_1.z.string().uuid().optional(),
    additionalOwnerIds: zod_1.z.array(zod_1.z.string().uuid()).max(25).optional(),
    ownerIds: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(25).optional(),
    riskScore: zod_1.z.coerce.number().min(0).max(999.99).optional(),
    lastAuditedAt: zod_1.z.string().datetime().optional(),
    auditFrequency: zod_1.z.nativeEnum(audit_enum_1.AuditFrequency),
})
    .refine((data) => Boolean(data.ownerId || (data.ownerIds && data.ownerIds.length > 0)), {
    message: 'At least one owner is required',
    path: ['ownerIds'],
});
exports.UpdateUniverseRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(5000).nullable().optional(),
    category: zod_1.z.nativeEnum(audit_enum_1.UniverseCategory).optional(),
    ownerId: zod_1.z.string().uuid().optional(),
    additionalOwnerIds: zod_1.z.array(zod_1.z.string().uuid()).max(25).optional(),
    ownerIds: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(25).optional(),
    riskScore: zod_1.z.coerce.number().min(0).max(999.99).nullable().optional(),
    lastAuditedAt: zod_1.z.string().datetime().nullable().optional(),
    auditFrequency: zod_1.z.nativeEnum(audit_enum_1.AuditFrequency).optional(),
    status: zod_1.z.nativeEnum(audit_enum_1.UniverseStatus).optional(),
});
exports.UniverseQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
    category: zod_1.z.nativeEnum(audit_enum_1.UniverseCategory).optional(),
    auditFrequency: zod_1.z.nativeEnum(audit_enum_1.AuditFrequency).optional(),
    status: zod_1.z.nativeEnum(audit_enum_1.UniverseStatus).optional(),
    sortBy: zod_1.z.enum(['risk_score', 'name', 'created_at', 'updated_at']).default('risk_score'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=universe.request.dto.js.map