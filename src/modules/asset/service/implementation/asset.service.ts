import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../shared/types/api-response.type';
import { assetWithDetailsInclude, AssetWithDetails } from '../../../../shared/prisma/prisma.types';
import { auditLogService } from '../../../logging/service/implementation/audit-log.service';
import { AssetActorContext } from '../../domain/entity/asset.entity';
import {
  assertAdminForSensitiveAssetFields,
  assertHasPermission,
  daysAgo,
  hasPermission,
  stringifyJson,
} from '../../utility/asset.utility';
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
import {
  AssetAuditContextResponseDto,
  AssetAttestationResponseDto,
  AssetLinkResponseDto,
  AssetRelationshipResponseDto,
  AssetResponseDto,
  AssetSourceResponseDto,
  mapAssetAttestationToResponse,
  mapAssetRelationshipToResponse,
  mapAssetSourceToResponse,
  mapAssetToResponse,
} from '../../dto/response/asset.response.dto';
import { IAssetService } from '../interface/asset.service.interface';

export class AssetService implements IAssetService {
  async createAsset(
    dto: CreateAssetRequestDto,
    actor: AssetActorContext,
  ): Promise<AssetResponseDto> {
    assertHasPermission(actor, 'asset:create');
    assertAdminForSensitiveAssetFields(actor, dto, 'create');

    const existing = await prisma.asset.findUnique({
      where: { asset_tag: dto.assetTag },
      select: { id: true },
    });
    if (existing) throw AppError.conflict(`Asset tag '${dto.assetTag}' already exists`);

    const asset = await prisma.asset.create({
      data: {
        asset_tag: dto.assetTag,
        name: dto.name,
        description: dto.description,
        asset_type: dto.assetType,
        category: dto.category,
        status: dto.status,
        lifecycle_state: dto.lifecycleState,
        criticality: dto.criticality,
        data_classification: dto.dataClassification,
        confidentiality_rating: dto.confidentialityRating,
        integrity_rating: dto.integrityRating,
        availability_rating: dto.availabilityRating,
        owner_id: dto.ownerId,
        custodian_id: dto.custodianId,
        department: dto.department,
        location: dto.location,
        environment: dto.environment,
        hostname: dto.hostname,
        ip_address: dto.ipAddress,
        serial_number: dto.serialNumber,
        manufacturer: dto.manufacturer,
        model: dto.model,
        os_name: dto.osName,
        os_version: dto.osVersion,
        supplier: dto.supplier,
        source_system: dto.sourceSystem,
        source_id: dto.sourceId,
        last_seen_at: dto.lastSeenAt ? new Date(dto.lastSeenAt) : null,
        metadata: stringifyJson(dto.metadata),
        created_by_id: actor.id,
      },
      include: assetWithDetailsInclude,
    }) as AssetWithDetails;

    const response = mapAssetToResponse(asset);
    logger.info('Asset created', { assetId: asset.id, assetTag: asset.asset_tag, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'asset.create',
      module: 'asset',
      entityType: 'asset',
      entityId: asset.id,
      newValues: response,
    });

    return response;
  }

  async updateAsset(
    id: string,
    dto: UpdateAssetRequestDto,
    actor: AssetActorContext,
  ): Promise<AssetResponseDto> {
    assertHasPermission(actor, 'asset:update');
    assertAdminForSensitiveAssetFields(actor, dto);
    await this._assertAssetExists(id);

    if (dto.assetTag !== undefined) {
      const existing = await prisma.asset.findFirst({
        where: { asset_tag: dto.assetTag, id: { not: id } },
        select: { id: true },
      });
      if (existing) throw AppError.conflict(`Asset tag '${dto.assetTag}' already exists`);
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(dto.assetTag !== undefined && { asset_tag: dto.assetTag }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.assetType !== undefined && { asset_type: dto.assetType }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.lifecycleState !== undefined && { lifecycle_state: dto.lifecycleState }),
        ...(dto.criticality !== undefined && { criticality: dto.criticality }),
        ...(dto.dataClassification !== undefined && { data_classification: dto.dataClassification }),
        ...(dto.confidentialityRating !== undefined && { confidentiality_rating: dto.confidentialityRating }),
        ...(dto.integrityRating !== undefined && { integrity_rating: dto.integrityRating }),
        ...(dto.availabilityRating !== undefined && { availability_rating: dto.availabilityRating }),
        ...(dto.ownerId !== undefined && { owner_id: dto.ownerId }),
        ...(dto.custodianId !== undefined && { custodian_id: dto.custodianId }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.environment !== undefined && { environment: dto.environment }),
        ...(dto.hostname !== undefined && { hostname: dto.hostname }),
        ...(dto.ipAddress !== undefined && { ip_address: dto.ipAddress }),
        ...(dto.serialNumber !== undefined && { serial_number: dto.serialNumber }),
        ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.osName !== undefined && { os_name: dto.osName }),
        ...(dto.osVersion !== undefined && { os_version: dto.osVersion }),
        ...(dto.supplier !== undefined && { supplier: dto.supplier }),
        ...(dto.sourceSystem !== undefined && { source_system: dto.sourceSystem }),
        ...(dto.sourceId !== undefined && { source_id: dto.sourceId }),
        ...(dto.lastSeenAt !== undefined && { last_seen_at: dto.lastSeenAt ? new Date(dto.lastSeenAt) : null }),
        ...(dto.metadata !== undefined && { metadata: stringifyJson(dto.metadata) }),
      },
      include: assetWithDetailsInclude,
    }) as AssetWithDetails;

    const response = mapAssetToResponse(asset);
    logger.info('Asset updated', { assetId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'asset.update',
      module: 'asset',
      entityType: 'asset',
      entityId: id,
      newValues: response,
    });

    return response;
  }

  async deleteAsset(id: string, actor: AssetActorContext): Promise<void> {
    assertHasPermission(actor, 'asset:delete');
    await this._assertAssetExists(id);

    await prisma.asset.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        status: 'inactive',
      },
    });

    logger.info('Asset soft-deleted', { assetId: id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'asset.delete',
      module: 'asset',
      entityType: 'asset',
      entityId: id,
    });
  }

  async getAssetById(id: string, actor: AssetActorContext): Promise<AssetResponseDto> {
    assertHasPermission(actor, 'asset:read');

    const asset = await prisma.asset.findFirst({
      where: { id, deleted_at: null },
      include: assetWithDetailsInclude,
    }) as AssetWithDetails | null;
    if (!asset) throw AppError.notFound('Asset');
    return mapAssetToResponse(asset);
  }

  async listAssets(
    query: AssetQueryDto,
    actor: AssetActorContext,
  ): Promise<{ assets: AssetResponseDto[]; meta: PaginationMeta }> {
    assertHasPermission(actor, 'asset:read');

    const { skip, take, page, pageSize } = parsePagination(query);
    const andFilters: Prisma.AssetWhereInput[] = [];
    if (query.stale) {
      andFilters.push({
        OR: [
          { last_seen_at: null },
          { last_seen_at: { lt: daysAgo(query.staleDays) } },
        ],
      });
    }
    if (query.unattested) {
      andFilters.push({
        OR: [
          { last_attested_at: null },
          { last_attested_at: { lt: daysAgo(query.unattestedDays) } },
        ],
      });
    }
    if (query.search) {
      andFilters.push({
        OR: [
          { asset_tag: { contains: query.search } },
          { name: { contains: query.search } },
          { hostname: { contains: query.search } },
          { serial_number: { contains: query.search } },
          { source_id: { contains: query.search } },
        ],
      });
    }

    const where: Prisma.AssetWhereInput = {
      deleted_at: null,
      ...(query.assetType && { asset_type: query.assetType }),
      ...(query.status && { status: query.status }),
      ...(query.lifecycleState && { lifecycle_state: query.lifecycleState }),
      ...(query.criticality && { criticality: query.criticality }),
      ...(query.dataClassification && { data_classification: query.dataClassification }),
      ...(query.ownerId && { owner_id: query.ownerId }),
      ...(query.custodianId && { custodian_id: query.custodianId }),
      ...(query.department && { department: query.department }),
      ...(query.environment && { environment: query.environment }),
      ...(query.sourceSystem && { source_system: query.sourceSystem }),
      ...(andFilters.length > 0 && { AND: andFilters }),
    };

    const [total, assets] = await prisma.$transaction([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        include: assetWithDetailsInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      assets: (assets as AssetWithDetails[]).map(mapAssetToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async listAssetsForUniverse(universeId: string, actor: AssetActorContext): Promise<AssetResponseDto[]> {
    assertHasPermission(actor, 'asset:read');
    await this._assertUniverseExists(universeId);

    const links = await prisma.audit_Universe_Asset.findMany({
      where: { universe_id: universeId, asset: { deleted_at: null } },
      include: { asset: { include: assetWithDetailsInclude } },
      orderBy: { created_at: 'desc' },
    });
    return links.map((link) => mapAssetToResponse(link.asset as AssetWithDetails));
  }

  async listAssetsForEngagement(engagementId: string, actor: AssetActorContext): Promise<AssetResponseDto[]> {
    assertHasPermission(actor, 'asset:read');
    await this._assertEngagementExists(engagementId);

    const links = await prisma.audit_Engagement_Asset.findMany({
      where: { engagement_id: engagementId, asset: { deleted_at: null } },
      include: { asset: { include: assetWithDetailsInclude } },
      orderBy: { created_at: 'desc' },
    });
    return links.map((link) => mapAssetToResponse(link.asset as AssetWithDetails));
  }

  async createRelationship(
    assetId: string,
    dto: CreateAssetRelationshipRequestDto,
    actor: AssetActorContext,
  ): Promise<AssetRelationshipResponseDto> {
    assertHasPermission(actor, 'asset:update');
    if (assetId === dto.targetAssetId) {
      throw AppError.badRequest('An asset cannot relate to itself');
    }
    await this._assertAssetExists(assetId);
    await this._assertAssetExists(dto.targetAssetId);

    const relationship = await prisma.asset_Relationship.create({
      data: {
        source_asset_id: assetId,
        target_asset_id: dto.targetAssetId,
        relationship_type: dto.relationshipType,
        description: dto.description,
        created_by_id: actor.id,
      },
      include: {
        source_asset: true,
        target_asset: true,
      },
    });

    logger.info('Asset relationship created', { assetId, targetAssetId: dto.targetAssetId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'asset.relationship.create',
      module: 'asset',
      entityType: 'asset_relationship',
      entityId: relationship.id,
      newValues: mapAssetRelationshipToResponse(relationship),
    });

    return mapAssetRelationshipToResponse(relationship);
  }

  async listRelationships(assetId: string, actor: AssetActorContext): Promise<AssetRelationshipResponseDto[]> {
    assertHasPermission(actor, 'asset:read');
    await this._assertAssetExists(assetId);

    const relationships = await prisma.asset_Relationship.findMany({
      where: {
        OR: [
          { source_asset_id: assetId },
          { target_asset_id: assetId },
        ],
      },
      include: {
        source_asset: true,
        target_asset: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return relationships.map(mapAssetRelationshipToResponse);
  }

  async deleteRelationship(assetId: string, relationshipId: string, actor: AssetActorContext): Promise<void> {
    assertHasPermission(actor, 'asset:update');
    await this._assertAssetExists(assetId);

    const relationship = await prisma.asset_Relationship.findFirst({
      where: {
        id: relationshipId,
        OR: [
          { source_asset_id: assetId },
          { target_asset_id: assetId },
        ],
      },
      select: { id: true },
    });
    if (!relationship) throw AppError.notFound('Asset relationship');

    await prisma.asset_Relationship.delete({ where: { id: relationshipId } });

    logger.info('Asset relationship deleted', { relationshipId, assetId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'asset.relationship.delete',
      module: 'asset',
      entityType: 'asset_relationship',
      entityId: relationshipId,
    });
  }

  async attestAsset(
    assetId: string,
    dto: CreateAssetAttestationRequestDto,
    actor: AssetActorContext,
  ): Promise<AssetAttestationResponseDto> {
    assertHasPermission(actor, 'asset:attest');
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, deleted_at: null },
      include: assetWithDetailsInclude,
    }) as AssetWithDetails | null;
    if (!asset) throw AppError.notFound('Asset');

    const canAttest =
      asset.owner_id === actor.id ||
      asset.custodian_id === actor.id ||
      hasPermission(actor, 'asset:admin');
    if (!canAttest) {
      throw AppError.forbidden('Only the asset owner, custodian, or asset admin can attest this asset');
    }

    const responseSnapshot = mapAssetToResponse(asset);
    const [attestation] = await prisma.$transaction([
      prisma.asset_Attestation.create({
        data: {
          asset_id: assetId,
          attested_by_id: actor.id,
          status: dto.status,
          notes: dto.notes,
          snapshot: JSON.stringify(responseSnapshot),
        },
        include: { attested_by: { select: assetWithDetailsInclude.owner.select } },
      }),
      prisma.asset.update({
        where: { id: assetId },
        data: { last_attested_at: new Date() },
      }),
    ]);

    logger.info('Asset attested', { assetId, actorId: actor.id, status: dto.status });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'asset.attest',
      module: 'asset',
      entityType: 'asset',
      entityId: assetId,
      newValues: { status: dto.status, notes: dto.notes },
    });

    return mapAssetAttestationToResponse(attestation);
  }

  async listAttestations(assetId: string, actor: AssetActorContext): Promise<AssetAttestationResponseDto[]> {
    assertHasPermission(actor, 'asset:read');
    await this._assertAssetExists(assetId);

    const attestations = await prisma.asset_Attestation.findMany({
      where: { asset_id: assetId },
      include: { attested_by: { select: assetWithDetailsInclude.owner.select } },
      orderBy: { attested_at: 'desc' },
    });
    return attestations.map(mapAssetAttestationToResponse);
  }

  async createSource(
    assetId: string,
    dto: CreateAssetSourceRequestDto,
    actor: AssetActorContext,
  ): Promise<AssetSourceResponseDto> {
    assertHasPermission(actor, 'asset:admin');
    await this._assertAssetExists(assetId);

    const source = await prisma.asset_Source.upsert({
      where: {
        source_system_source_id: {
          source_system: dto.sourceSystem,
          source_id: dto.sourceId,
        },
      },
      create: {
        asset_id: assetId,
        source_system: dto.sourceSystem,
        source_id: dto.sourceId,
        sync_status: dto.syncStatus,
        last_synced_at: dto.lastSyncedAt ? new Date(dto.lastSyncedAt) : null,
        raw_payload: stringifyJson(dto.rawPayload),
      },
      update: {
        asset_id: assetId,
        sync_status: dto.syncStatus,
        last_synced_at: dto.lastSyncedAt ? new Date(dto.lastSyncedAt) : null,
        raw_payload: stringifyJson(dto.rawPayload),
      },
    });

    logger.info('Asset source upserted', { assetId, sourceSystem: dto.sourceSystem, sourceId: dto.sourceId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'asset.source.upsert',
      module: 'asset',
      entityType: 'asset_source',
      entityId: source.id,
      newValues: mapAssetSourceToResponse(source),
    });

    return mapAssetSourceToResponse(source);
  }

  async listSources(assetId: string, actor: AssetActorContext): Promise<AssetSourceResponseDto[]> {
    assertHasPermission(actor, 'asset:read');
    await this._assertAssetExists(assetId);

    const sources = await prisma.asset_Source.findMany({
      where: { asset_id: assetId },
      orderBy: { updated_at: 'desc' },
    });
    return sources.map(mapAssetSourceToResponse);
  }

  async linkToUniverse(assetId: string, universeId: string, actor: AssetActorContext): Promise<AssetLinkResponseDto> {
    assertHasPermission(actor, 'asset:link');
    await this._assertAssetExists(assetId);
    await this._assertUniverseExists(universeId);

    const link = await prisma.audit_Universe_Asset.upsert({
      where: { universe_id_asset_id: { universe_id: universeId, asset_id: assetId } },
      create: { universe_id: universeId, asset_id: assetId, created_by_id: actor.id },
      update: {},
    });
    this._logLink('asset.link.universe', 'audit_universe_asset', link.id, actor, { assetId, universeId });
    return this._mapLink(link.id, assetId, 'audit_universe', universeId, link.created_by_id, link.created_at);
  }

  async unlinkFromUniverse(assetId: string, universeId: string, actor: AssetActorContext): Promise<void> {
    assertHasPermission(actor, 'asset:link');
    const result = await prisma.audit_Universe_Asset.deleteMany({ where: { asset_id: assetId, universe_id: universeId } });
    if (result.count === 0) throw AppError.notFound('Asset audit universe link');
    this._logUnlink('asset.unlink.universe', 'audit_universe_asset', actor, { assetId, universeId });
  }

  async linkToEngagement(
    engagementId: string,
    dto: LinkAssetToEngagementRequestDto,
    actor: AssetActorContext,
  ): Promise<AssetLinkResponseDto> {
    assertHasPermission(actor, 'asset:link');
    await this._assertAssetExists(dto.assetId);
    await this._assertEngagementExists(engagementId);

    const link = await prisma.audit_Engagement_Asset.upsert({
      where: { engagement_id_asset_id: { engagement_id: engagementId, asset_id: dto.assetId } },
      create: {
        engagement_id: engagementId,
        asset_id: dto.assetId,
        scope_role: dto.scopeRole,
        scope_reason: dto.scopeReason,
        created_by_id: actor.id,
      },
      update: {
        scope_role: dto.scopeRole,
        scope_reason: dto.scopeReason,
      },
    });
    this._logLink('asset.link.engagement', 'audit_engagement_asset', link.id, actor, { assetId: dto.assetId, engagementId });
    return this._mapLink(link.id, dto.assetId, 'audit_engagement', engagementId, link.created_by_id, link.created_at, {
      scopeRole: link.scope_role,
      scopeReason: link.scope_reason,
    });
  }

  async unlinkFromEngagement(engagementId: string, assetId: string, actor: AssetActorContext): Promise<void> {
    assertHasPermission(actor, 'asset:link');
    const result = await prisma.audit_Engagement_Asset.deleteMany({ where: { engagement_id: engagementId, asset_id: assetId } });
    if (result.count === 0) throw AppError.notFound('Asset engagement link');
    this._logUnlink('asset.unlink.engagement', 'audit_engagement_asset', actor, { assetId, engagementId });
  }

  async linkToFinding(
    assetId: string,
    findingId: string,
    dto: LinkAssetToFindingRequestDto,
    actor: AssetActorContext,
  ): Promise<AssetLinkResponseDto> {
    assertHasPermission(actor, 'asset:link');
    await this._assertAssetExists(assetId);
    await this._assertFindingExists(findingId);

    const link = await prisma.audit_Finding_Asset.upsert({
      where: { finding_id_asset_id: { finding_id: findingId, asset_id: assetId } },
      create: {
        finding_id: findingId,
        asset_id: assetId,
        impact_summary: dto.impactSummary,
        created_by_id: actor.id,
      },
      update: { impact_summary: dto.impactSummary },
    });
    this._logLink('asset.link.finding', 'audit_finding_asset', link.id, actor, { assetId, findingId });
    return this._mapLink(link.id, assetId, 'audit_finding', findingId, link.created_by_id, link.created_at, {
      impactSummary: link.impact_summary,
    });
  }

  async unlinkFromFinding(assetId: string, findingId: string, actor: AssetActorContext): Promise<void> {
    assertHasPermission(actor, 'asset:link');
    const result = await prisma.audit_Finding_Asset.deleteMany({ where: { asset_id: assetId, finding_id: findingId } });
    if (result.count === 0) throw AppError.notFound('Asset finding link');
    this._logUnlink('asset.unlink.finding', 'audit_finding_asset', actor, { assetId, findingId });
  }

  async linkToRisk(
    assetId: string,
    riskId: string,
    dto: LinkAssetToRiskRequestDto,
    actor: AssetActorContext,
  ): Promise<AssetLinkResponseDto> {
    assertHasPermission(actor, 'asset:link');
    await this._assertAssetExists(assetId);
    await this._assertRiskExists(riskId);

    const link = await prisma.risk_Asset_Link.upsert({
      where: { risk_id_asset_id: { risk_id: riskId, asset_id: assetId } },
      create: {
        risk_id: riskId,
        asset_id: assetId,
        link_reason: dto.linkReason,
        created_by_id: actor.id,
      },
      update: { link_reason: dto.linkReason },
    });
    this._logLink('asset.link.risk', 'risk_asset_link', link.id, actor, { assetId, riskId });
    return this._mapLink(link.id, assetId, 'risk_register', riskId, link.created_by_id, link.created_at, {
      linkReason: link.link_reason,
    });
  }

  async unlinkFromRisk(assetId: string, riskId: string, actor: AssetActorContext): Promise<void> {
    assertHasPermission(actor, 'asset:link');
    const result = await prisma.risk_Asset_Link.deleteMany({ where: { asset_id: assetId, risk_id: riskId } });
    if (result.count === 0) throw AppError.notFound('Asset risk link');
    this._logUnlink('asset.unlink.risk', 'risk_asset_link', actor, { assetId, riskId });
  }

  async linkToEvidence(assetId: string, evidenceId: string, actor: AssetActorContext): Promise<AssetLinkResponseDto> {
    assertHasPermission(actor, 'asset:link');
    await this._assertAssetExists(assetId);
    await this._assertEvidenceExists(evidenceId);

    const link = await prisma.audit_Evidence_Asset.upsert({
      where: { evidence_id_asset_id: { evidence_id: evidenceId, asset_id: assetId } },
      create: { evidence_id: evidenceId, asset_id: assetId, created_by_id: actor.id },
      update: {},
    });
    this._logLink('asset.link.evidence', 'audit_evidence_asset', link.id, actor, { assetId, evidenceId });
    return this._mapLink(link.id, assetId, 'audit_evidence', evidenceId, link.created_by_id, link.created_at);
  }

  async unlinkFromEvidence(assetId: string, evidenceId: string, actor: AssetActorContext): Promise<void> {
    assertHasPermission(actor, 'asset:link');
    const result = await prisma.audit_Evidence_Asset.deleteMany({ where: { asset_id: assetId, evidence_id: evidenceId } });
    if (result.count === 0) throw AppError.notFound('Asset evidence link');
    this._logUnlink('asset.unlink.evidence', 'audit_evidence_asset', actor, { assetId, evidenceId });
  }

  async getAuditContext(assetId: string, actor: AssetActorContext): Promise<AssetAuditContextResponseDto> {
    assertHasPermission(actor, 'asset:read');
    await this._assertAssetExists(assetId);

    const [universeLinks, engagementLinks, findingLinks, riskLinks, evidenceLinks] = await prisma.$transaction([
      prisma.audit_Universe_Asset.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
      prisma.audit_Engagement_Asset.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
      prisma.audit_Finding_Asset.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
      prisma.risk_Asset_Link.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
      prisma.audit_Evidence_Asset.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
    ]);

    return {
      universeLinks: universeLinks.map((link) => this._mapLink(link.id, assetId, 'audit_universe', link.universe_id, link.created_by_id, link.created_at)),
      engagementLinks: engagementLinks.map((link) => this._mapLink(link.id, assetId, 'audit_engagement', link.engagement_id, link.created_by_id, link.created_at, {
        scopeRole: link.scope_role,
        scopeReason: link.scope_reason,
      })),
      findingLinks: findingLinks.map((link) => this._mapLink(link.id, assetId, 'audit_finding', link.finding_id, link.created_by_id, link.created_at, {
        impactSummary: link.impact_summary,
      })),
      riskLinks: riskLinks.map((link) => this._mapLink(link.id, assetId, 'risk_register', link.risk_id, link.created_by_id, link.created_at, {
        linkReason: link.link_reason,
      })),
      evidenceLinks: evidenceLinks.map((link) => this._mapLink(link.id, assetId, 'audit_evidence', link.evidence_id, link.created_by_id, link.created_at)),
    };
  }

  private async _assertAssetExists(id: string): Promise<void> {
    const asset = await prisma.asset.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });
    if (!asset) throw AppError.notFound('Asset');
  }

  private async _assertUniverseExists(id: string): Promise<void> {
    const universe = await prisma.audit_Universe.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!universe) throw AppError.notFound('Audit universe entity');
  }

  private async _assertEngagementExists(id: string): Promise<void> {
    const engagement = await prisma.audit_Engagement.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!engagement) throw AppError.notFound('Audit engagement');
  }

  private async _assertFindingExists(id: string): Promise<void> {
    const finding = await prisma.audit_Finding.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!finding) throw AppError.notFound('Audit finding');
  }

  private async _assertRiskExists(id: string): Promise<void> {
    const risk = await prisma.risk_Register.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!risk) throw AppError.notFound('Risk');
  }

  private async _assertEvidenceExists(id: string): Promise<void> {
    const evidence = await prisma.audit_Evidence.findUnique({ where: { id }, select: { id: true } });
    if (!evidence) throw AppError.notFound('Audit evidence');
  }

  private _mapLink(
    id: string,
    assetId: string,
    linkedEntityType: string,
    linkedEntityId: string,
    createdById: string,
    createdAt: Date,
    extra: Partial<AssetLinkResponseDto> = {},
  ): AssetLinkResponseDto {
    return {
      id,
      assetId,
      linkedEntityType,
      linkedEntityId,
      createdById,
      createdAt: createdAt.toISOString(),
      ...extra,
    };
  }

  private _logLink(
    action: string,
    entityType: string,
    entityId: string,
    actor: AssetActorContext,
    newValues: Record<string, unknown>,
  ): void {
    logger.info('Asset link updated', { action, entityType, entityId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action,
      module: 'asset',
      entityType,
      entityId,
      newValues,
    });
  }

  private _logUnlink(
    action: string,
    entityType: string,
    actor: AssetActorContext,
    oldValues: Record<string, unknown>,
  ): void {
    logger.info('Asset link removed', { action, entityType, actorId: actor.id, ...oldValues });
    auditLogService.logAsync({
      userId: actor.id,
      action,
      module: 'asset',
      entityType,
      oldValues,
    });
  }
}

export const assetService = new AssetService();
