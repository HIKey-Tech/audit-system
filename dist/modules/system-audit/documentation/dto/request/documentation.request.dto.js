"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemDocumentListQuerySchema = exports.UploadSystemDocumentVersionSchema = exports.UpdateSystemDocumentSchema = exports.CreateSystemDocumentSchema = void 0;
const zod_1 = require("zod");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
// Multipart forms send absent optional fields as empty strings.
const blankToUndefined = (value) => (value === '' || value === 'null' ? undefined : value);
const OptionalText = (max) => zod_1.z.preprocess(blankToUndefined, zod_1.z.string().trim().max(max).optional());
const OptionalUuid = zod_1.z.preprocess(blankToUndefined, zod_1.z.string().uuid().optional());
const OptionalDate = zod_1.z.preprocess(blankToUndefined, zod_1.z.coerce.date().optional());
// JSON updates may clear a field with null.
const NullableText = (max) => zod_1.z.string().trim().max(max).nullable().optional();
const NullableDate = zod_1.z.coerce.date().nullable().optional();
exports.CreateSystemDocumentSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(200),
    docType: zod_1.z.nativeEnum(system_audit_enum_1.SystemDocumentType),
    description: OptionalText(4000),
    versionLabel: OptionalText(50),
    /** Defaults to the uploader. */
    ownerId: OptionalUuid,
    universeId: OptionalUuid,
    assetId: OptionalUuid,
    vendor: OptionalText(200),
    effectiveDate: OptionalDate,
    reviewDueDate: OptionalDate,
    expiryDate: OptionalDate,
});
exports.UpdateSystemDocumentSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(200).optional(),
    docType: zod_1.z.nativeEnum(system_audit_enum_1.SystemDocumentType).optional(),
    description: NullableText(4000),
    versionLabel: NullableText(50),
    ownerId: zod_1.z.string().uuid().optional(),
    universeId: zod_1.z.string().uuid().nullable().optional(),
    assetId: zod_1.z.string().uuid().nullable().optional(),
    vendor: NullableText(200),
    effectiveDate: NullableDate,
    reviewDueDate: NullableDate,
    expiryDate: NullableDate,
    status: zod_1.z.nativeEnum(system_audit_enum_1.SystemDocumentStatus).optional(),
});
exports.UploadSystemDocumentVersionSchema = zod_1.z.object({
    versionLabel: OptionalText(50),
    changeNote: OptionalText(500),
    /** A new version usually restarts the review cycle. */
    reviewDueDate: OptionalDate,
});
exports.SystemDocumentListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    docType: zod_1.z.nativeEnum(system_audit_enum_1.SystemDocumentType).optional(),
    status: zod_1.z.nativeEnum(system_audit_enum_1.SystemDocumentStatus).optional(),
    universeId: zod_1.z.string().uuid().optional(),
    assetId: zod_1.z.string().uuid().optional(),
    /** Documents relevant to an engagement's scope: its audit-universe entity and linked assets. */
    engagementId: zod_1.z.string().uuid().optional(),
    ownerId: zod_1.z.string().uuid().optional(),
    reviewState: zod_1.z.enum(['overdue', 'due_soon']).optional(),
    contractState: zod_1.z.enum(['expired', 'expiring']).optional(),
    search: zod_1.z.string().trim().min(1).max(200).optional(),
});
//# sourceMappingURL=documentation.request.dto.js.map