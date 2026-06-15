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
declare const mapUserToResponse: (user: {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string;
    last_name: string;
    department: string | null;
    job_title: string | null;
}) => AssetUserResponseDto;
declare const mapAssetBrief: (asset: {
    id: string;
    asset_tag: string;
    name: string;
    asset_type: string;
    criticality: string;
}) => Pick<AssetResponseDto, "id" | "assetTag" | "name" | "assetType" | "criticality">;
export declare const mapAssetToResponse: (asset: {
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
}) => AssetResponseDto;
export declare const mapAssetRelationshipToResponse: (relationship: {
    id: string;
    source_asset_id: string;
    target_asset_id: string;
    relationship_type: string;
    description: string | null;
    source_asset?: Parameters<typeof mapAssetBrief>[0];
    target_asset?: Parameters<typeof mapAssetBrief>[0];
    created_by_id: string;
    created_at: Date;
}) => AssetRelationshipResponseDto;
export declare const mapAssetAttestationToResponse: (attestation: {
    id: string;
    asset_id: string;
    attested_by_id: string;
    attested_by?: Parameters<typeof mapUserToResponse>[0];
    status: string;
    notes: string | null;
    snapshot: string;
    attested_at: Date;
    created_at: Date;
}) => AssetAttestationResponseDto;
export declare const mapAssetSourceToResponse: (source: {
    id: string;
    asset_id: string;
    source_system: string;
    source_id: string;
    sync_status: string;
    last_synced_at: Date | null;
    raw_payload: string | null;
    created_at: Date;
    updated_at: Date;
}) => AssetSourceResponseDto;
export {};
//# sourceMappingURL=asset.response.dto.d.ts.map