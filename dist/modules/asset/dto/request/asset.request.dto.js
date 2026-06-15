"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkAssetToRiskRequestSchema = exports.LinkAssetToFindingRequestSchema = exports.LinkAssetToEngagementRequestSchema = exports.CreateAssetSourceRequestSchema = exports.CreateAssetAttestationRequestSchema = exports.CreateAssetRelationshipRequestSchema = exports.AssetQuerySchema = exports.UpdateAssetRequestSchema = exports.CreateAssetRequestSchema = void 0;
const zod_1 = require("zod");
const asset_enum_1 = require("../../domain/enum/asset.enum");
const JsonRecordSchema = zod_1.z.record(zod_1.z.unknown());
const OptionalDateSchema = zod_1.z.string().datetime().nullable().optional();
const QueryBooleanSchema = zod_1.z.preprocess((value) => {
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    return value;
}, zod_1.z.boolean());
exports.CreateAssetRequestSchema = zod_1.z.object({
    assetTag: zod_1.z.string().min(1).max(100),
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(5000).nullable().optional(),
    assetType: zod_1.z.nativeEnum(asset_enum_1.AssetType),
    category: zod_1.z.string().max(100).nullable().optional(),
    status: zod_1.z.nativeEnum(asset_enum_1.AssetStatus).default(asset_enum_1.AssetStatus.Active),
    lifecycleState: zod_1.z.nativeEnum(asset_enum_1.AssetLifecycleState).default(asset_enum_1.AssetLifecycleState.Active),
    criticality: zod_1.z.nativeEnum(asset_enum_1.AssetRating).default(asset_enum_1.AssetRating.Medium),
    dataClassification: zod_1.z.nativeEnum(asset_enum_1.DataClassification).default(asset_enum_1.DataClassification.Internal),
    confidentialityRating: zod_1.z.nativeEnum(asset_enum_1.AssetRating).default(asset_enum_1.AssetRating.Medium),
    integrityRating: zod_1.z.nativeEnum(asset_enum_1.AssetRating).default(asset_enum_1.AssetRating.Medium),
    availabilityRating: zod_1.z.nativeEnum(asset_enum_1.AssetRating).default(asset_enum_1.AssetRating.Medium),
    ownerId: zod_1.z.string().uuid(),
    custodianId: zod_1.z.string().uuid().nullable().optional(),
    department: zod_1.z.string().max(150).nullable().optional(),
    location: zod_1.z.string().max(200).nullable().optional(),
    environment: zod_1.z.string().max(100).nullable().optional(),
    hostname: zod_1.z.string().max(255).nullable().optional(),
    ipAddress: zod_1.z.string().max(100).nullable().optional(),
    serialNumber: zod_1.z.string().max(150).nullable().optional(),
    manufacturer: zod_1.z.string().max(150).nullable().optional(),
    model: zod_1.z.string().max(150).nullable().optional(),
    osName: zod_1.z.string().max(150).nullable().optional(),
    osVersion: zod_1.z.string().max(150).nullable().optional(),
    supplier: zod_1.z.string().max(150).nullable().optional(),
    sourceSystem: zod_1.z.nativeEnum(asset_enum_1.AssetSourceSystem).default(asset_enum_1.AssetSourceSystem.Manual),
    sourceId: zod_1.z.string().max(255).nullable().optional(),
    lastSeenAt: OptionalDateSchema,
    metadata: JsonRecordSchema.nullable().optional(),
});
exports.UpdateAssetRequestSchema = exports.CreateAssetRequestSchema.partial().extend({
    assetTag: zod_1.z.string().min(1).max(100).optional(),
    name: zod_1.z.string().min(1).max(200).optional(),
});
exports.AssetQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    search: zod_1.z.string().max(200).optional(),
    assetType: zod_1.z.nativeEnum(asset_enum_1.AssetType).optional(),
    status: zod_1.z.nativeEnum(asset_enum_1.AssetStatus).optional(),
    lifecycleState: zod_1.z.nativeEnum(asset_enum_1.AssetLifecycleState).optional(),
    criticality: zod_1.z.nativeEnum(asset_enum_1.AssetRating).optional(),
    dataClassification: zod_1.z.nativeEnum(asset_enum_1.DataClassification).optional(),
    ownerId: zod_1.z.string().uuid().optional(),
    custodianId: zod_1.z.string().uuid().optional(),
    department: zod_1.z.string().max(150).optional(),
    environment: zod_1.z.string().max(100).optional(),
    sourceSystem: zod_1.z.nativeEnum(asset_enum_1.AssetSourceSystem).optional(),
    stale: QueryBooleanSchema.optional(),
    staleDays: zod_1.z.coerce.number().int().positive().max(3650).default(90),
    unattested: QueryBooleanSchema.optional(),
    unattestedDays: zod_1.z.coerce.number().int().positive().max(3650).default(365),
    sortBy: zod_1.z
        .enum(['asset_tag', 'name', 'asset_type', 'criticality', 'last_seen_at', 'last_attested_at', 'created_at', 'updated_at'])
        .default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.CreateAssetRelationshipRequestSchema = zod_1.z.object({
    targetAssetId: zod_1.z.string().uuid(),
    relationshipType: zod_1.z.nativeEnum(asset_enum_1.AssetRelationshipType),
    description: zod_1.z.string().max(2000).nullable().optional(),
});
exports.CreateAssetAttestationRequestSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(asset_enum_1.AssetAttestationStatus).default(asset_enum_1.AssetAttestationStatus.Confirmed),
    notes: zod_1.z.string().max(3000).nullable().optional(),
});
exports.CreateAssetSourceRequestSchema = zod_1.z.object({
    sourceSystem: zod_1.z.nativeEnum(asset_enum_1.AssetSourceSystem),
    sourceId: zod_1.z.string().min(1).max(255),
    syncStatus: zod_1.z.nativeEnum(asset_enum_1.AssetSyncStatus).default(asset_enum_1.AssetSyncStatus.Synced),
    lastSyncedAt: OptionalDateSchema,
    rawPayload: JsonRecordSchema.nullable().optional(),
});
exports.LinkAssetToEngagementRequestSchema = zod_1.z.object({
    assetId: zod_1.z.string().uuid(),
    scopeRole: zod_1.z.nativeEnum(asset_enum_1.AssetScopeRole).default(asset_enum_1.AssetScopeRole.Primary),
    scopeReason: zod_1.z.string().max(3000).nullable().optional(),
});
exports.LinkAssetToFindingRequestSchema = zod_1.z.object({
    impactSummary: zod_1.z.string().max(3000).nullable().optional(),
});
exports.LinkAssetToRiskRequestSchema = zod_1.z.object({
    linkReason: zod_1.z.string().max(3000).nullable().optional(),
});
//# sourceMappingURL=asset.request.dto.js.map