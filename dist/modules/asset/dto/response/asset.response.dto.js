"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAssetSourceToResponse = exports.mapAssetAttestationToResponse = exports.mapAssetRelationshipToResponse = exports.mapAssetToResponse = void 0;
const parseJson = (value, fallback) => {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
};
const mapUserToResponse = (user) => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    firstName: user.first_name,
    lastName: user.last_name,
    department: user.department,
    jobTitle: user.job_title,
});
const mapAssetBrief = (asset) => ({
    id: asset.id,
    assetTag: asset.asset_tag,
    name: asset.name,
    assetType: asset.asset_type,
    criticality: asset.criticality,
});
const mapAssetToResponse = (asset) => ({
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
    metadata: parseJson(asset.metadata, null),
    createdById: asset.created_by_id,
    createdBy: asset.created_by ? mapUserToResponse(asset.created_by) : undefined,
    createdAt: asset.created_at.toISOString(),
    updatedAt: asset.updated_at.toISOString(),
});
exports.mapAssetToResponse = mapAssetToResponse;
const mapAssetRelationshipToResponse = (relationship) => ({
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
exports.mapAssetRelationshipToResponse = mapAssetRelationshipToResponse;
const mapAssetAttestationToResponse = (attestation) => ({
    id: attestation.id,
    assetId: attestation.asset_id,
    attestedById: attestation.attested_by_id,
    attestedBy: attestation.attested_by ? mapUserToResponse(attestation.attested_by) : undefined,
    status: attestation.status,
    notes: attestation.notes,
    snapshot: parseJson(attestation.snapshot, {}),
    attestedAt: attestation.attested_at.toISOString(),
    createdAt: attestation.created_at.toISOString(),
});
exports.mapAssetAttestationToResponse = mapAssetAttestationToResponse;
const mapAssetSourceToResponse = (source) => ({
    id: source.id,
    assetId: source.asset_id,
    sourceSystem: source.source_system,
    sourceId: source.source_id,
    syncStatus: source.sync_status,
    lastSyncedAt: source.last_synced_at?.toISOString() ?? null,
    rawPayload: parseJson(source.raw_payload, null),
    createdAt: source.created_at.toISOString(),
    updatedAt: source.updated_at.toISOString(),
});
exports.mapAssetSourceToResponse = mapAssetSourceToResponse;
//# sourceMappingURL=asset.response.dto.js.map