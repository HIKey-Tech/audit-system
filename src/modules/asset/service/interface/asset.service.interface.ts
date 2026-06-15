import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { AssetActorContext } from '../../domain/entity/asset.entity';
import {
  AssetAuditContextResponseDto,
  AssetAttestationResponseDto,
  AssetRelationshipResponseDto,
  AssetResponseDto,
  AssetSourceResponseDto,
  AssetLinkResponseDto,
} from '../../dto/response/asset.response.dto';
import {
  AssetQueryDto,
  CreateAssetAttestationRequestDto,
  CreateAssetRelationshipRequestDto,
  CreateAssetRequestDto,
  CreateAssetSourceRequestDto,
  LinkAssetToEngagementRequestDto,
  LinkAssetToFindingRequestDto,
  LinkAssetToRiskRequestDto,
  UpdateAssetRequestDto,
} from '../../dto/request/asset.request.dto';

export interface IAssetService {
  createAsset(dto: CreateAssetRequestDto, actor: AssetActorContext): Promise<AssetResponseDto>;
  updateAsset(id: string, dto: UpdateAssetRequestDto, actor: AssetActorContext): Promise<AssetResponseDto>;
  deleteAsset(id: string, actor: AssetActorContext): Promise<void>;
  getAssetById(id: string, actor: AssetActorContext): Promise<AssetResponseDto>;
  listAssets(query: AssetQueryDto, actor: AssetActorContext): Promise<{ assets: AssetResponseDto[]; meta: PaginationMeta }>;
  listAssetsForUniverse(universeId: string, actor: AssetActorContext): Promise<AssetResponseDto[]>;
  listAssetsForEngagement(engagementId: string, actor: AssetActorContext): Promise<AssetResponseDto[]>;

  createRelationship(assetId: string, dto: CreateAssetRelationshipRequestDto, actor: AssetActorContext): Promise<AssetRelationshipResponseDto>;
  listRelationships(assetId: string, actor: AssetActorContext): Promise<AssetRelationshipResponseDto[]>;
  deleteRelationship(assetId: string, relationshipId: string, actor: AssetActorContext): Promise<void>;

  attestAsset(assetId: string, dto: CreateAssetAttestationRequestDto, actor: AssetActorContext): Promise<AssetAttestationResponseDto>;
  listAttestations(assetId: string, actor: AssetActorContext): Promise<AssetAttestationResponseDto[]>;

  createSource(assetId: string, dto: CreateAssetSourceRequestDto, actor: AssetActorContext): Promise<AssetSourceResponseDto>;
  listSources(assetId: string, actor: AssetActorContext): Promise<AssetSourceResponseDto[]>;

  linkToUniverse(assetId: string, universeId: string, actor: AssetActorContext): Promise<AssetLinkResponseDto>;
  unlinkFromUniverse(assetId: string, universeId: string, actor: AssetActorContext): Promise<void>;
  linkToEngagement(engagementId: string, dto: LinkAssetToEngagementRequestDto, actor: AssetActorContext): Promise<AssetLinkResponseDto>;
  unlinkFromEngagement(engagementId: string, assetId: string, actor: AssetActorContext): Promise<void>;
  linkToFinding(assetId: string, findingId: string, dto: LinkAssetToFindingRequestDto, actor: AssetActorContext): Promise<AssetLinkResponseDto>;
  unlinkFromFinding(assetId: string, findingId: string, actor: AssetActorContext): Promise<void>;
  linkToRisk(assetId: string, riskId: string, dto: LinkAssetToRiskRequestDto, actor: AssetActorContext): Promise<AssetLinkResponseDto>;
  unlinkFromRisk(assetId: string, riskId: string, actor: AssetActorContext): Promise<void>;
  linkToEvidence(assetId: string, evidenceId: string, actor: AssetActorContext): Promise<AssetLinkResponseDto>;
  unlinkFromEvidence(assetId: string, evidenceId: string, actor: AssetActorContext): Promise<void>;
  getAuditContext(assetId: string, actor: AssetActorContext): Promise<AssetAuditContextResponseDto>;
}
