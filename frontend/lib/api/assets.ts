import { api } from '../api-client';
import type {
  Asset,
  AssetAuditContext,
  AssetAttestation,
  AssetLink,
  AssetRelationship,
  AssetSource,
} from '../types/domain';

export interface AssetListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  assetType?: string;
  status?: string;
  lifecycleState?: string;
  criticality?: string;
  dataClassification?: string;
  ownerId?: string;
  custodianId?: string;
  department?: string;
  environment?: string;
  sourceSystem?: string;
  stale?: boolean;
  staleDays?: number;
  unattested?: boolean;
  unattestedDays?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AssetPayload {
  assetTag: string;
  name: string;
  description?: string | null;
  assetType: string;
  category?: string | null;
  status?: string;
  lifecycleState?: string;
  criticality?: string;
  dataClassification?: string;
  confidentialityRating?: string;
  integrityRating?: string;
  availabilityRating?: string;
  ownerId: string;
  custodianId?: string | null;
  department?: string | null;
  location?: string | null;
  environment?: string | null;
  hostname?: string | null;
  ipAddress?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  supplier?: string | null;
  sourceSystem?: string;
  sourceId?: string | null;
  lastSeenAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AssetRelationshipPayload {
  targetAssetId: string;
  relationshipType: string;
  description?: string | null;
}

export interface AssetAttestationPayload {
  status: string;
  notes?: string | null;
}

export interface AssetSourcePayload {
  sourceSystem: string;
  sourceId: string;
  syncStatus?: string;
  lastSyncedAt?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

export interface EngagementAssetPayload {
  assetId: string;
  scopeRole?: string;
  scopeReason?: string | null;
}

export interface FindingAssetPayload {
  impactSummary?: string | null;
}

export interface RiskAssetPayload {
  linkReason?: string | null;
}

const asQuery = (q?: AssetListQuery): Record<string, string | number | boolean | undefined> =>
  q as Record<string, string | number | boolean | undefined>;

export const assetsApi = {
  list: (query?: AssetListQuery) => api.getPaginated<Asset>('/assets', asQuery(query)),
  get: (id: string) => api.get<Asset>(`/assets/${id}`),
  create: (payload: AssetPayload) => api.post<Asset>('/assets', payload),
  update: (id: string, payload: Partial<AssetPayload>) => api.patch<Asset>(`/assets/${id}`, payload),
  remove: (id: string) => api.delete(`/assets/${id}`),

  listRelationships: (assetId: string) => api.get<AssetRelationship[]>(`/assets/${assetId}/relationships`),
  createRelationship: (assetId: string, payload: AssetRelationshipPayload) =>
    api.post<AssetRelationship>(`/assets/${assetId}/relationships`, payload),
  deleteRelationship: (assetId: string, relationshipId: string) =>
    api.delete(`/assets/${assetId}/relationships/${relationshipId}`),

  listAttestations: (assetId: string) => api.get<AssetAttestation[]>(`/assets/${assetId}/attestations`),
  attest: (assetId: string, payload: AssetAttestationPayload) =>
    api.post<AssetAttestation>(`/assets/${assetId}/attest`, payload),

  listSources: (assetId: string) => api.get<AssetSource[]>(`/assets/${assetId}/sources`),
  createSource: (assetId: string, payload: AssetSourcePayload) =>
    api.post<AssetSource>(`/assets/${assetId}/sources`, payload),

  getAuditContext: (assetId: string) => api.get<AssetAuditContext>(`/assets/${assetId}/audit-context`),

  linkToUniverse: (assetId: string, universeId: string) =>
    api.post<AssetLink>(`/assets/${assetId}/universe/${universeId}`),
  unlinkFromUniverse: (assetId: string, universeId: string) =>
    api.delete(`/assets/${assetId}/universe/${universeId}`),

  listForUniverse: (universeId: string) => api.get<Asset[]>(`/audit/universe/${universeId}/assets`),
  listForEngagement: (engagementId: string) => api.get<Asset[]>(`/audit/engagements/${engagementId}/assets`),
  listForFinding: (findingId: string) => api.get<Asset[]>(`/audit/findings/${findingId}/assets`),
  listForRisk: (riskId: string) => api.get<Asset[]>(`/audit/risks/${riskId}/assets`),
  listForEvidence: (evidenceId: string) => api.get<Asset[]>(`/audit/evidence/${evidenceId}/assets`),
  linkToEngagement: (engagementId: string, payload: EngagementAssetPayload) =>
    api.post<AssetLink>(`/audit/engagements/${engagementId}/assets`, payload),
  unlinkFromEngagement: (engagementId: string, assetId: string) =>
    api.delete(`/audit/engagements/${engagementId}/assets/${assetId}`),

  linkToFinding: (assetId: string, findingId: string, payload: FindingAssetPayload = {}) =>
    api.post<AssetLink>(`/assets/${assetId}/findings/${findingId}`, payload),
  unlinkFromFinding: (assetId: string, findingId: string) =>
    api.delete(`/assets/${assetId}/findings/${findingId}`),

  linkToRisk: (assetId: string, riskId: string, payload: RiskAssetPayload = {}) =>
    api.post<AssetLink>(`/assets/${assetId}/risks/${riskId}`, payload),
  unlinkFromRisk: (assetId: string, riskId: string) =>
    api.delete(`/assets/${assetId}/risks/${riskId}`),

  linkToEvidence: (assetId: string, evidenceId: string) =>
    api.post<AssetLink>(`/assets/${assetId}/evidence/${evidenceId}`),
  unlinkFromEvidence: (assetId: string, evidenceId: string) =>
    api.delete(`/assets/${assetId}/evidence/${evidenceId}`),
};
