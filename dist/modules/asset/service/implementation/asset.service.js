"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetService = exports.AssetService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const prisma_types_1 = require("../../../../shared/prisma/prisma.types");
const audit_log_service_1 = require("../../../logging/service/implementation/audit-log.service");
const asset_utility_1 = require("../../utility/asset.utility");
const asset_response_dto_1 = require("../../dto/response/asset.response.dto");
class AssetService {
    async createAsset(dto, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:create');
        (0, asset_utility_1.assertAdminForSensitiveAssetFields)(actor, dto, 'create');
        const existing = await prisma_client_1.prisma.asset.findUnique({
            where: { asset_tag: dto.assetTag },
            select: { id: true },
        });
        if (existing)
            throw app_error_1.AppError.conflict(`Asset tag '${dto.assetTag}' already exists`);
        const asset = await prisma_client_1.prisma.asset.create({
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
                metadata: (0, asset_utility_1.stringifyJson)(dto.metadata),
                created_by_id: actor.id,
            },
            include: prisma_types_1.assetWithDetailsInclude,
        });
        const response = (0, asset_response_dto_1.mapAssetToResponse)(asset);
        logger_util_1.logger.info('Asset created', { assetId: asset.id, assetTag: asset.asset_tag, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'asset.create',
            module: 'asset',
            entityType: 'asset',
            entityId: asset.id,
            newValues: response,
        });
        return response;
    }
    async updateAsset(id, dto, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:update');
        (0, asset_utility_1.assertAdminForSensitiveAssetFields)(actor, dto);
        await this._assertAssetExists(id);
        if (dto.assetTag !== undefined) {
            const existing = await prisma_client_1.prisma.asset.findFirst({
                where: { asset_tag: dto.assetTag, id: { not: id } },
                select: { id: true },
            });
            if (existing)
                throw app_error_1.AppError.conflict(`Asset tag '${dto.assetTag}' already exists`);
        }
        const asset = await prisma_client_1.prisma.asset.update({
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
                ...(dto.metadata !== undefined && { metadata: (0, asset_utility_1.stringifyJson)(dto.metadata) }),
            },
            include: prisma_types_1.assetWithDetailsInclude,
        });
        const response = (0, asset_response_dto_1.mapAssetToResponse)(asset);
        logger_util_1.logger.info('Asset updated', { assetId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'asset.update',
            module: 'asset',
            entityType: 'asset',
            entityId: id,
            newValues: response,
        });
        return response;
    }
    async deleteAsset(id, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:delete');
        await this._assertAssetExists(id);
        await prisma_client_1.prisma.asset.update({
            where: { id },
            data: {
                deleted_at: new Date(),
                status: 'inactive',
            },
        });
        logger_util_1.logger.info('Asset soft-deleted', { assetId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'asset.delete',
            module: 'asset',
            entityType: 'asset',
            entityId: id,
        });
    }
    async getAssetById(id, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:read');
        const asset = await prisma_client_1.prisma.asset.findFirst({
            where: { id, deleted_at: null },
            include: prisma_types_1.assetWithDetailsInclude,
        });
        if (!asset)
            throw app_error_1.AppError.notFound('Asset');
        return (0, asset_response_dto_1.mapAssetToResponse)(asset);
    }
    async listAssets(query, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:read');
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const andFilters = [];
        if (query.stale) {
            andFilters.push({
                OR: [
                    { last_seen_at: null },
                    { last_seen_at: { lt: (0, asset_utility_1.daysAgo)(query.staleDays) } },
                ],
            });
        }
        if (query.unattested) {
            andFilters.push({
                OR: [
                    { last_attested_at: null },
                    { last_attested_at: { lt: (0, asset_utility_1.daysAgo)(query.unattestedDays) } },
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
        const where = {
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
        const [total, assets] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.asset.count({ where }),
            prisma_client_1.prisma.asset.findMany({
                where,
                include: prisma_types_1.assetWithDetailsInclude,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            assets: assets.map(asset_response_dto_1.mapAssetToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async listAssetsForUniverse(universeId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:read');
        await this._assertUniverseExists(universeId);
        const links = await prisma_client_1.prisma.audit_Universe_Asset.findMany({
            where: { universe_id: universeId, asset: { deleted_at: null } },
            include: { asset: { include: prisma_types_1.assetWithDetailsInclude } },
            orderBy: { created_at: 'desc' },
        });
        return links.map((link) => (0, asset_response_dto_1.mapAssetToResponse)(link.asset));
    }
    async listAssetsForEngagement(engagementId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:read');
        await this._assertEngagementExists(engagementId);
        const links = await prisma_client_1.prisma.audit_Engagement_Asset.findMany({
            where: { engagement_id: engagementId, asset: { deleted_at: null } },
            include: { asset: { include: prisma_types_1.assetWithDetailsInclude } },
            orderBy: { created_at: 'desc' },
        });
        return links.map((link) => (0, asset_response_dto_1.mapAssetToResponse)(link.asset));
    }
    async createRelationship(assetId, dto, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:update');
        if (assetId === dto.targetAssetId) {
            throw app_error_1.AppError.badRequest('An asset cannot relate to itself');
        }
        await this._assertAssetExists(assetId);
        await this._assertAssetExists(dto.targetAssetId);
        const relationship = await prisma_client_1.prisma.asset_Relationship.create({
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
        logger_util_1.logger.info('Asset relationship created', { assetId, targetAssetId: dto.targetAssetId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'asset.relationship.create',
            module: 'asset',
            entityType: 'asset_relationship',
            entityId: relationship.id,
            newValues: (0, asset_response_dto_1.mapAssetRelationshipToResponse)(relationship),
        });
        return (0, asset_response_dto_1.mapAssetRelationshipToResponse)(relationship);
    }
    async listRelationships(assetId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:read');
        await this._assertAssetExists(assetId);
        const relationships = await prisma_client_1.prisma.asset_Relationship.findMany({
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
        return relationships.map(asset_response_dto_1.mapAssetRelationshipToResponse);
    }
    async deleteRelationship(assetId, relationshipId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:update');
        await this._assertAssetExists(assetId);
        const relationship = await prisma_client_1.prisma.asset_Relationship.findFirst({
            where: {
                id: relationshipId,
                OR: [
                    { source_asset_id: assetId },
                    { target_asset_id: assetId },
                ],
            },
            select: { id: true },
        });
        if (!relationship)
            throw app_error_1.AppError.notFound('Asset relationship');
        await prisma_client_1.prisma.asset_Relationship.delete({ where: { id: relationshipId } });
        logger_util_1.logger.info('Asset relationship deleted', { relationshipId, assetId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'asset.relationship.delete',
            module: 'asset',
            entityType: 'asset_relationship',
            entityId: relationshipId,
        });
    }
    async attestAsset(assetId, dto, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:attest');
        const asset = await prisma_client_1.prisma.asset.findFirst({
            where: { id: assetId, deleted_at: null },
            include: prisma_types_1.assetWithDetailsInclude,
        });
        if (!asset)
            throw app_error_1.AppError.notFound('Asset');
        const canAttest = asset.owner_id === actor.id ||
            asset.custodian_id === actor.id ||
            (0, asset_utility_1.hasPermission)(actor, 'asset:admin');
        if (!canAttest) {
            throw app_error_1.AppError.forbidden('Only the asset owner, custodian, or asset admin can attest this asset');
        }
        const responseSnapshot = (0, asset_response_dto_1.mapAssetToResponse)(asset);
        const [attestation] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.asset_Attestation.create({
                data: {
                    asset_id: assetId,
                    attested_by_id: actor.id,
                    status: dto.status,
                    notes: dto.notes,
                    snapshot: JSON.stringify(responseSnapshot),
                },
                include: { attested_by: { select: prisma_types_1.assetWithDetailsInclude.owner.select } },
            }),
            prisma_client_1.prisma.asset.update({
                where: { id: assetId },
                data: { last_attested_at: new Date() },
            }),
        ]);
        logger_util_1.logger.info('Asset attested', { assetId, actorId: actor.id, status: dto.status });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'asset.attest',
            module: 'asset',
            entityType: 'asset',
            entityId: assetId,
            newValues: { status: dto.status, notes: dto.notes },
        });
        return (0, asset_response_dto_1.mapAssetAttestationToResponse)(attestation);
    }
    async listAttestations(assetId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:read');
        await this._assertAssetExists(assetId);
        const attestations = await prisma_client_1.prisma.asset_Attestation.findMany({
            where: { asset_id: assetId },
            include: { attested_by: { select: prisma_types_1.assetWithDetailsInclude.owner.select } },
            orderBy: { attested_at: 'desc' },
        });
        return attestations.map(asset_response_dto_1.mapAssetAttestationToResponse);
    }
    async createSource(assetId, dto, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:admin');
        await this._assertAssetExists(assetId);
        const source = await prisma_client_1.prisma.asset_Source.upsert({
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
                raw_payload: (0, asset_utility_1.stringifyJson)(dto.rawPayload),
            },
            update: {
                asset_id: assetId,
                sync_status: dto.syncStatus,
                last_synced_at: dto.lastSyncedAt ? new Date(dto.lastSyncedAt) : null,
                raw_payload: (0, asset_utility_1.stringifyJson)(dto.rawPayload),
            },
        });
        logger_util_1.logger.info('Asset source upserted', { assetId, sourceSystem: dto.sourceSystem, sourceId: dto.sourceId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'asset.source.upsert',
            module: 'asset',
            entityType: 'asset_source',
            entityId: source.id,
            newValues: (0, asset_response_dto_1.mapAssetSourceToResponse)(source),
        });
        return (0, asset_response_dto_1.mapAssetSourceToResponse)(source);
    }
    async listSources(assetId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:read');
        await this._assertAssetExists(assetId);
        const sources = await prisma_client_1.prisma.asset_Source.findMany({
            where: { asset_id: assetId },
            orderBy: { updated_at: 'desc' },
        });
        return sources.map(asset_response_dto_1.mapAssetSourceToResponse);
    }
    async linkToUniverse(assetId, universeId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        await this._assertAssetExists(assetId);
        await this._assertUniverseExists(universeId);
        const link = await prisma_client_1.prisma.audit_Universe_Asset.upsert({
            where: { universe_id_asset_id: { universe_id: universeId, asset_id: assetId } },
            create: { universe_id: universeId, asset_id: assetId, created_by_id: actor.id },
            update: {},
        });
        this._logLink('asset.link.universe', 'audit_universe_asset', link.id, actor, { assetId, universeId });
        return this._mapLink(link.id, assetId, 'audit_universe', universeId, link.created_by_id, link.created_at);
    }
    async unlinkFromUniverse(assetId, universeId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        const result = await prisma_client_1.prisma.audit_Universe_Asset.deleteMany({ where: { asset_id: assetId, universe_id: universeId } });
        if (result.count === 0)
            throw app_error_1.AppError.notFound('Asset audit universe link');
        this._logUnlink('asset.unlink.universe', 'audit_universe_asset', actor, { assetId, universeId });
    }
    async linkToEngagement(engagementId, dto, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        await this._assertAssetExists(dto.assetId);
        await this._assertEngagementExists(engagementId);
        const link = await prisma_client_1.prisma.audit_Engagement_Asset.upsert({
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
    async unlinkFromEngagement(engagementId, assetId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        const result = await prisma_client_1.prisma.audit_Engagement_Asset.deleteMany({ where: { engagement_id: engagementId, asset_id: assetId } });
        if (result.count === 0)
            throw app_error_1.AppError.notFound('Asset engagement link');
        this._logUnlink('asset.unlink.engagement', 'audit_engagement_asset', actor, { assetId, engagementId });
    }
    async linkToFinding(assetId, findingId, dto, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        await this._assertAssetExists(assetId);
        await this._assertFindingExists(findingId);
        const link = await prisma_client_1.prisma.audit_Finding_Asset.upsert({
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
    async unlinkFromFinding(assetId, findingId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        const result = await prisma_client_1.prisma.audit_Finding_Asset.deleteMany({ where: { asset_id: assetId, finding_id: findingId } });
        if (result.count === 0)
            throw app_error_1.AppError.notFound('Asset finding link');
        this._logUnlink('asset.unlink.finding', 'audit_finding_asset', actor, { assetId, findingId });
    }
    async linkToRisk(assetId, riskId, dto, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        await this._assertAssetExists(assetId);
        await this._assertRiskExists(riskId);
        const link = await prisma_client_1.prisma.risk_Asset_Link.upsert({
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
    async unlinkFromRisk(assetId, riskId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        const result = await prisma_client_1.prisma.risk_Asset_Link.deleteMany({ where: { asset_id: assetId, risk_id: riskId } });
        if (result.count === 0)
            throw app_error_1.AppError.notFound('Asset risk link');
        this._logUnlink('asset.unlink.risk', 'risk_asset_link', actor, { assetId, riskId });
    }
    async linkToEvidence(assetId, evidenceId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        await this._assertAssetExists(assetId);
        await this._assertEvidenceExists(evidenceId);
        const link = await prisma_client_1.prisma.audit_Evidence_Asset.upsert({
            where: { evidence_id_asset_id: { evidence_id: evidenceId, asset_id: assetId } },
            create: { evidence_id: evidenceId, asset_id: assetId, created_by_id: actor.id },
            update: {},
        });
        this._logLink('asset.link.evidence', 'audit_evidence_asset', link.id, actor, { assetId, evidenceId });
        return this._mapLink(link.id, assetId, 'audit_evidence', evidenceId, link.created_by_id, link.created_at);
    }
    async unlinkFromEvidence(assetId, evidenceId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:link');
        const result = await prisma_client_1.prisma.audit_Evidence_Asset.deleteMany({ where: { asset_id: assetId, evidence_id: evidenceId } });
        if (result.count === 0)
            throw app_error_1.AppError.notFound('Asset evidence link');
        this._logUnlink('asset.unlink.evidence', 'audit_evidence_asset', actor, { assetId, evidenceId });
    }
    async getAuditContext(assetId, actor) {
        (0, asset_utility_1.assertHasPermission)(actor, 'asset:read');
        await this._assertAssetExists(assetId);
        const [universeLinks, engagementLinks, findingLinks, riskLinks, evidenceLinks] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Universe_Asset.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
            prisma_client_1.prisma.audit_Engagement_Asset.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
            prisma_client_1.prisma.audit_Finding_Asset.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
            prisma_client_1.prisma.risk_Asset_Link.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
            prisma_client_1.prisma.audit_Evidence_Asset.findMany({ where: { asset_id: assetId }, orderBy: { created_at: 'desc' } }),
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
    async _assertAssetExists(id) {
        const asset = await prisma_client_1.prisma.asset.findFirst({
            where: { id, deleted_at: null },
            select: { id: true },
        });
        if (!asset)
            throw app_error_1.AppError.notFound('Asset');
    }
    async _assertUniverseExists(id) {
        const universe = await prisma_client_1.prisma.audit_Universe.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
        if (!universe)
            throw app_error_1.AppError.notFound('Audit universe entity');
    }
    async _assertEngagementExists(id) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
    }
    async _assertFindingExists(id) {
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
    }
    async _assertRiskExists(id) {
        const risk = await prisma_client_1.prisma.risk_Register.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
        if (!risk)
            throw app_error_1.AppError.notFound('Risk');
    }
    async _assertEvidenceExists(id) {
        const evidence = await prisma_client_1.prisma.audit_Evidence.findUnique({ where: { id }, select: { id: true } });
        if (!evidence)
            throw app_error_1.AppError.notFound('Audit evidence');
    }
    _mapLink(id, assetId, linkedEntityType, linkedEntityId, createdById, createdAt, extra = {}) {
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
    _logLink(action, entityType, entityId, actor, newValues) {
        logger_util_1.logger.info('Asset link updated', { action, entityType, entityId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action,
            module: 'asset',
            entityType,
            entityId,
            newValues,
        });
    }
    _logUnlink(action, entityType, actor, oldValues) {
        logger_util_1.logger.info('Asset link removed', { action, entityType, actorId: actor.id, ...oldValues });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action,
            module: 'asset',
            entityType,
            oldValues,
        });
    }
}
exports.AssetService = AssetService;
exports.assetService = new AssetService();
//# sourceMappingURL=asset.service.js.map