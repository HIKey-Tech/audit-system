"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityTestListQuerySchema = exports.SecurityTestAssetsSchema = exports.AuthoriseSecurityTestSchema = exports.ChangeSecurityTestStatusSchema = exports.UpdateSecurityTestSchema = exports.CreateSecurityTestSchema = void 0;
const zod_1 = require("zod");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
const BaseSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(200),
    testType: zod_1.z.nativeEnum(system_audit_enum_1.SecurityTestType),
    engagementId: zod_1.z.string().uuid().nullable().optional(),
    provider: zod_1.z.string().trim().min(1).max(200),
    providerType: zod_1.z.nativeEnum(system_audit_enum_1.SecurityTestProviderType).default(system_audit_enum_1.SecurityTestProviderType.Internal),
    scope: zod_1.z.string().trim().min(1).max(10_000),
    rulesOfEngagement: zod_1.z.string().trim().max(20_000).nullable().optional(),
    plannedStart: zod_1.z.string().datetime(),
    plannedEnd: zod_1.z.string().datetime(),
    /** Defaults to the creator. */
    coordinatorId: zod_1.z.string().uuid().optional(),
    notes: zod_1.z.string().trim().max(10_000).nullable().optional(),
});
const endAfterStart = (d) => !d.plannedStart || !d.plannedEnd || new Date(d.plannedEnd) >= new Date(d.plannedStart);
exports.CreateSecurityTestSchema = BaseSchema.extend({
    assetIds: zod_1.z.array(zod_1.z.string().uuid()).max(50).optional(),
}).refine(endAfterStart, { message: 'The planned end must be on or after the planned start', path: ['plannedEnd'] });
exports.UpdateSecurityTestSchema = BaseSchema.partial()
    .omit({ providerType: true })
    .extend({ providerType: zod_1.z.nativeEnum(system_audit_enum_1.SecurityTestProviderType).optional() })
    .refine(endAfterStart, { message: 'The planned end must be on or after the planned start', path: ['plannedEnd'] });
exports.ChangeSecurityTestStatusSchema = zod_1.z.object({
    status: zod_1.z.enum([
        system_audit_enum_1.SecurityTestStatus.InProgress,
        system_audit_enum_1.SecurityTestStatus.Reporting,
        system_audit_enum_1.SecurityTestStatus.Remediation,
        system_audit_enum_1.SecurityTestStatus.Closed,
        system_audit_enum_1.SecurityTestStatus.Cancelled,
    ]),
    note: zod_1.z.string().trim().max(4000).optional(),
});
exports.AuthoriseSecurityTestSchema = zod_1.z.object({
    note: zod_1.z.string().trim().max(4000).optional(),
});
exports.SecurityTestAssetsSchema = zod_1.z.object({
    assetIds: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(50),
});
exports.SecurityTestListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.nativeEnum(system_audit_enum_1.SecurityTestStatus).optional(),
    testType: zod_1.z.nativeEnum(system_audit_enum_1.SecurityTestType).optional(),
    engagementId: zod_1.z.string().uuid().optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
});
//# sourceMappingURL=security-test.request.dto.js.map