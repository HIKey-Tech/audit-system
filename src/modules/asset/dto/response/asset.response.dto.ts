export interface AssetUserResponseDto {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
}

export interface AssetResponseDto {
  id: string;
  assetTag: string;
  name: string;
  description: string | null;
  assetType: string;
  category: string | null;
  status: string;
  lifecycleState: string;
  criticality: string;
  dataClassification: string;
  confidentialityRating: string;
  integrityRating: string;
  availabilityRating: string;
  ownerId: string;
  owner?: AssetUserResponseDto;
  custodianId: string | null;
  custodian?: AssetUserResponseDto | null;
  department: string | null;
  location: string | null;
  environment: string | null;
  hostname: string | null;
  ipAddress: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  osName: string | null;
  osVersion: string | null;
  supplier: string | null;
  sourceSystem: string;
  sourceId: string | null;
  lastSeenAt: string | null;
  lastAttestedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdById: string;
  createdBy?: AssetUserResponseDto;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRelationshipResponseDto {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: string;
  description: string | null;
  targetAsset?: Pick<AssetResponseDto, 'id' | 'assetTag' | 'name' | 'assetType' | 'criticality'>;
  sourceAsset?: Pick<AssetResponseDto, 'id' | 'assetTag' | 'name' | 'assetType' | 'criticality'>;
  createdById: string;
  createdAt: string;
}

export interface AssetAttestationResponseDto {
  id: string;
  assetId: string;
  attestedById: string;
  attestedBy?: AssetUserResponseDto;
  status: string;
  notes: string | null;
  snapshot: Record<string, unknown>;
  attestedAt: string;
  createdAt: string;
}

export interface AssetSourceResponseDto {
  id: string;
  assetId: string;
  sourceSystem: string;
  sourceId: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  rawPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetLinkResponseDto {
  id: string;
  assetId: string;
  linkedEntityType: string;
  linkedEntityId: string;
  scopeRole?: string;
  scopeReason?: string | null;
  impactSummary?: string | null;
  linkReason?: string | null;
  createdById: string;
  createdAt: string;
}

export interface AssetAuditContextResponseDto {
  universeLinks: AssetLinkResponseDto[];
  engagementLinks: AssetLinkResponseDto[];
  findingLinks: AssetLinkResponseDto[];
  riskLinks: AssetLinkResponseDto[];
  evidenceLinks: AssetLinkResponseDto[];
}

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const mapUserToResponse = (user: {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
  department: string | null;
  job_title: string | null;
}): AssetUserResponseDto => ({
  id: user.id,
  email: user.email,
  displayName: user.display_name,
  firstName: user.first_name,
  lastName: user.last_name,
  department: user.department,
  jobTitle: user.job_title,
});

const mapAssetBrief = (asset: {
  id: string;
  asset_tag: string;
  name: string;
  asset_type: string;
  criticality: string;
}): Pick<AssetResponseDto, 'id' | 'assetTag' | 'name' | 'assetType' | 'criticality'> => ({
  id: asset.id,
  assetTag: asset.asset_tag,
  name: asset.name,
  assetType: asset.asset_type,
  criticality: asset.criticality,
});

export const mapAssetToResponse = (asset: {
  id: string;
  asset_tag: string;
  name: string;
  description: string | null;
  asset_type: string;
  category: string | null;
  status: string;
  lifecycle_state: string;
  criticality: string;
  data_classification: string;
  confidentiality_rating: string;
  integrity_rating: string;
  availability_rating: string;
  owner_id: string;
  owner?: Parameters<typeof mapUserToResponse>[0];
  custodian_id: string | null;
  custodian?: Parameters<typeof mapUserToResponse>[0] | null;
  department: string | null;
  location: string | null;
  environment: string | null;
  hostname: string | null;
  ip_address: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  os_name: string | null;
  os_version: string | null;
  supplier: string | null;
  source_system: string;
  source_id: string | null;
  last_seen_at: Date | null;
  last_attested_at: Date | null;
  metadata: string | null;
  created_by_id: string;
  created_by?: Parameters<typeof mapUserToResponse>[0];
  created_at: Date;
  updated_at: Date;
}): AssetResponseDto => ({
  id: asset.id,
  assetTag: asset.asset_tag,
  name: asset.name,
  description: asset.description,
  assetType: asset.asset_type,
  category: asset.category,
  status: asset.status,
  lifecycleState: asset.lifecycle_state,
  criticality: asset.criticality,
  dataClassification: asset.data_classification,
  confidentialityRating: asset.confidentiality_rating,
  integrityRating: asset.integrity_rating,
  availabilityRating: asset.availability_rating,
  ownerId: asset.owner_id,
  owner: asset.owner ? mapUserToResponse(asset.owner) : undefined,
  custodianId: asset.custodian_id,
  custodian: asset.custodian === undefined ? undefined : asset.custodian ? mapUserToResponse(asset.custodian) : null,
  department: asset.department,
  location: asset.location,
  environment: asset.environment,
  hostname: asset.hostname,
  ipAddress: asset.ip_address,
  serialNumber: asset.serial_number,
  manufacturer: asset.manufacturer,
  model: asset.model,
  osName: asset.os_name,
  osVersion: asset.os_version,
  supplier: asset.supplier,
  sourceSystem: asset.source_system,
  sourceId: asset.source_id,
  lastSeenAt: asset.last_seen_at?.toISOString() ?? null,
  lastAttestedAt: asset.last_attested_at?.toISOString() ?? null,
  metadata: parseJson<Record<string, unknown> | null>(asset.metadata, null),
  createdById: asset.created_by_id,
  createdBy: asset.created_by ? mapUserToResponse(asset.created_by) : undefined,
  createdAt: asset.created_at.toISOString(),
  updatedAt: asset.updated_at.toISOString(),
});

export const mapAssetRelationshipToResponse = (relationship: {
  id: string;
  source_asset_id: string;
  target_asset_id: string;
  relationship_type: string;
  description: string | null;
  source_asset?: Parameters<typeof mapAssetBrief>[0];
  target_asset?: Parameters<typeof mapAssetBrief>[0];
  created_by_id: string;
  created_at: Date;
}): AssetRelationshipResponseDto => ({
  id: relationship.id,
  sourceAssetId: relationship.source_asset_id,
  targetAssetId: relationship.target_asset_id,
  relationshipType: relationship.relationship_type,
  description: relationship.description,
  sourceAsset: relationship.source_asset ? mapAssetBrief(relationship.source_asset) : undefined,
  targetAsset: relationship.target_asset ? mapAssetBrief(relationship.target_asset) : undefined,
  createdById: relationship.created_by_id,
  createdAt: relationship.created_at.toISOString(),
});

export const mapAssetAttestationToResponse = (attestation: {
  id: string;
  asset_id: string;
  attested_by_id: string;
  attested_by?: Parameters<typeof mapUserToResponse>[0];
  status: string;
  notes: string | null;
  snapshot: string;
  attested_at: Date;
  created_at: Date;
}): AssetAttestationResponseDto => ({
  id: attestation.id,
  assetId: attestation.asset_id,
  attestedById: attestation.attested_by_id,
  attestedBy: attestation.attested_by ? mapUserToResponse(attestation.attested_by) : undefined,
  status: attestation.status,
  notes: attestation.notes,
  snapshot: parseJson<Record<string, unknown>>(attestation.snapshot, {}),
  attestedAt: attestation.attested_at.toISOString(),
  createdAt: attestation.created_at.toISOString(),
});

export const mapAssetSourceToResponse = (source: {
  id: string;
  asset_id: string;
  source_system: string;
  source_id: string;
  sync_status: string;
  last_synced_at: Date | null;
  raw_payload: string | null;
  created_at: Date;
  updated_at: Date;
}): AssetSourceResponseDto => ({
  id: source.id,
  assetId: source.asset_id,
  sourceSystem: source.source_system,
  sourceId: source.source_id,
  syncStatus: source.sync_status,
  lastSyncedAt: source.last_synced_at?.toISOString() ?? null,
  rawPayload: parseJson<Record<string, unknown> | null>(source.raw_payload, null),
  createdAt: source.created_at.toISOString(),
  updatedAt: source.updated_at.toISOString(),
});
