import { z } from 'zod';
import {
  AssetAttestationStatus,
  AssetLifecycleState,
  AssetRating,
  AssetRelationshipType,
  AssetScopeRole,
  AssetSourceSystem,
  AssetStatus,
  AssetSyncStatus,
  AssetType,
  DataClassification,
} from '../../domain/enum/asset.enum';

const JsonRecordSchema = z.record(z.unknown());
const OptionalDateSchema = z.string().datetime().nullable().optional();
const QueryBooleanSchema = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const CreateAssetRequestSchema = z.object({
  assetTag: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  assetType: z.nativeEnum(AssetType),
  category: z.string().max(100).nullable().optional(),
  status: z.nativeEnum(AssetStatus).default(AssetStatus.Active),
  lifecycleState: z.nativeEnum(AssetLifecycleState).default(AssetLifecycleState.Active),
  criticality: z.nativeEnum(AssetRating).default(AssetRating.Medium),
  dataClassification: z.nativeEnum(DataClassification).default(DataClassification.Internal),
  confidentialityRating: z.nativeEnum(AssetRating).default(AssetRating.Medium),
  integrityRating: z.nativeEnum(AssetRating).default(AssetRating.Medium),
  availabilityRating: z.nativeEnum(AssetRating).default(AssetRating.Medium),
  ownerId: z.string().uuid(),
  custodianId: z.string().uuid().nullable().optional(),
  department: z.string().max(150).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  environment: z.string().max(100).nullable().optional(),
  hostname: z.string().max(255).nullable().optional(),
  ipAddress: z.string().max(100).nullable().optional(),
  serialNumber: z.string().max(150).nullable().optional(),
  manufacturer: z.string().max(150).nullable().optional(),
  model: z.string().max(150).nullable().optional(),
  osName: z.string().max(150).nullable().optional(),
  osVersion: z.string().max(150).nullable().optional(),
  supplier: z.string().max(150).nullable().optional(),
  sourceSystem: z.nativeEnum(AssetSourceSystem).default(AssetSourceSystem.Manual),
  sourceId: z.string().max(255).nullable().optional(),
  lastSeenAt: OptionalDateSchema,
  metadata: JsonRecordSchema.nullable().optional(),
});

export const UpdateAssetRequestSchema = CreateAssetRequestSchema.partial().extend({
  assetTag: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
});

export const AssetQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(200).optional(),
  assetType: z.nativeEnum(AssetType).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  lifecycleState: z.nativeEnum(AssetLifecycleState).optional(),
  criticality: z.nativeEnum(AssetRating).optional(),
  dataClassification: z.nativeEnum(DataClassification).optional(),
  ownerId: z.string().uuid().optional(),
  custodianId: z.string().uuid().optional(),
  department: z.string().max(150).optional(),
  environment: z.string().max(100).optional(),
  sourceSystem: z.nativeEnum(AssetSourceSystem).optional(),
  stale: QueryBooleanSchema.optional(),
  staleDays: z.coerce.number().int().positive().max(3650).default(90),
  unattested: QueryBooleanSchema.optional(),
  unattestedDays: z.coerce.number().int().positive().max(3650).default(365),
  sortBy: z
    .enum(['asset_tag', 'name', 'asset_type', 'criticality', 'last_seen_at', 'last_attested_at', 'created_at', 'updated_at'])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateAssetRelationshipRequestSchema = z.object({
  targetAssetId: z.string().uuid(),
  relationshipType: z.nativeEnum(AssetRelationshipType),
  description: z.string().max(2000).nullable().optional(),
});

export const CreateAssetAttestationRequestSchema = z.object({
  status: z.nativeEnum(AssetAttestationStatus).default(AssetAttestationStatus.Confirmed),
  notes: z.string().max(3000).nullable().optional(),
});

export const CreateAssetSourceRequestSchema = z.object({
  sourceSystem: z.nativeEnum(AssetSourceSystem),
  sourceId: z.string().min(1).max(255),
  syncStatus: z.nativeEnum(AssetSyncStatus).default(AssetSyncStatus.Synced),
  lastSyncedAt: OptionalDateSchema,
  rawPayload: JsonRecordSchema.nullable().optional(),
});

export const LinkAssetToEngagementRequestSchema = z.object({
  assetId: z.string().uuid(),
  scopeRole: z.nativeEnum(AssetScopeRole).default(AssetScopeRole.Primary),
  scopeReason: z.string().max(3000).nullable().optional(),
});

export const LinkAssetToFindingRequestSchema = z.object({
  impactSummary: z.string().max(3000).nullable().optional(),
});

export const LinkAssetToRiskRequestSchema = z.object({
  linkReason: z.string().max(3000).nullable().optional(),
});

export type CreateAssetRequestDto = z.infer<typeof CreateAssetRequestSchema>;
export type UpdateAssetRequestDto = z.infer<typeof UpdateAssetRequestSchema>;
export type AssetQueryDto = z.infer<typeof AssetQuerySchema>;
export type CreateAssetRelationshipRequestDto = z.infer<typeof CreateAssetRelationshipRequestSchema>;
export type CreateAssetAttestationRequestDto = z.infer<typeof CreateAssetAttestationRequestSchema>;
export type CreateAssetSourceRequestDto = z.infer<typeof CreateAssetSourceRequestSchema>;
export type LinkAssetToEngagementRequestDto = z.infer<typeof LinkAssetToEngagementRequestSchema>;
export type LinkAssetToFindingRequestDto = z.infer<typeof LinkAssetToFindingRequestSchema>;
export type LinkAssetToRiskRequestDto = z.infer<typeof LinkAssetToRiskRequestSchema>;
