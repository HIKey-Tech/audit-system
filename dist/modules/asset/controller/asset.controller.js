"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const asset_request_dto_1 = require("../dto/request/asset.request.dto");
class AssetController {
    assetService;
    router;
    auditRouter;
    constructor(assetService) {
        this.assetService = assetService;
        this.router = (0, express_1.Router)();
        this.auditRouter = (0, express_1.Router)();
        this._registerRoutes();
        this._registerAuditRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /assets
         * @desc   List assets
         * @access Private - asset:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('asset:read'), (0, validate_middleware_1.validate)(asset_request_dto_1.AssetQuerySchema, 'query'), this._listAssets.bind(this));
        /**
         * @route  POST /assets
         * @desc   Create asset
         * @access Private - asset:create
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('asset:create'), (0, validate_middleware_1.validate)(asset_request_dto_1.CreateAssetRequestSchema), this._createAsset.bind(this));
        /**
         * @route  GET /assets/:id
         * @desc   Get asset detail
         * @access Private - asset:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('asset:read'), this._getAssetById.bind(this));
        /**
         * @route  PATCH /assets/:id
         * @desc   Update asset
         * @access Private - asset:update
         */
        this.router.patch('/:id', (0, auth_middleware_1.requirePermission)('asset:update'), (0, validate_middleware_1.validate)(asset_request_dto_1.UpdateAssetRequestSchema), this._updateAsset.bind(this));
        /**
         * @route  DELETE /assets/:id
         * @desc   Soft-delete asset
         * @access Private - asset:delete
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('asset:delete'), this._deleteAsset.bind(this));
        /**
         * @route  GET /assets/:id/relationships
         * @desc   List asset relationships
         * @access Private - asset:read
         */
        this.router.get('/:id/relationships', (0, auth_middleware_1.requirePermission)('asset:read'), this._listRelationships.bind(this));
        /**
         * @route  POST /assets/:id/relationships
         * @desc   Create asset relationship
         * @access Private - asset:update
         */
        this.router.post('/:id/relationships', (0, auth_middleware_1.requirePermission)('asset:update'), (0, validate_middleware_1.validate)(asset_request_dto_1.CreateAssetRelationshipRequestSchema), this._createRelationship.bind(this));
        /**
         * @route  DELETE /assets/:id/relationships/:relationshipId
         * @desc   Delete asset relationship
         * @access Private - asset:update
         */
        this.router.delete('/:id/relationships/:relationshipId', (0, auth_middleware_1.requirePermission)('asset:update'), this._deleteRelationship.bind(this));
        /**
         * @route  GET /assets/:id/attestations
         * @desc   List asset attestations
         * @access Private - asset:read
         */
        this.router.get('/:id/attestations', (0, auth_middleware_1.requirePermission)('asset:read'), this._listAttestations.bind(this));
        /**
         * @route  POST /assets/:id/attest
         * @desc   Attest asset accuracy
         * @access Private - asset:attest
         */
        this.router.post('/:id/attest', (0, auth_middleware_1.requirePermission)('asset:attest'), (0, validate_middleware_1.validate)(asset_request_dto_1.CreateAssetAttestationRequestSchema), this._attestAsset.bind(this));
        /**
         * @route  GET /assets/:id/sources
         * @desc   List asset source records
         * @access Private - asset:read
         */
        this.router.get('/:id/sources', (0, auth_middleware_1.requirePermission)('asset:read'), this._listSources.bind(this));
        /**
         * @route  POST /assets/:id/sources
         * @desc   Upsert asset source record
         * @access Private - asset:admin
         */
        this.router.post('/:id/sources', (0, auth_middleware_1.requirePermission)('asset:admin'), (0, validate_middleware_1.validate)(asset_request_dto_1.CreateAssetSourceRequestSchema), this._createSource.bind(this));
        /**
         * @route  GET /assets/:id/audit-context
         * @desc   Get audit/risk/evidence links for an asset
         * @access Private - asset:read
         */
        this.router.get('/:id/audit-context', (0, auth_middleware_1.requirePermission)('asset:read'), this._getAuditContext.bind(this));
        /**
         * @route  POST /assets/:id/universe/:universeId
         * @desc   Link asset to audit universe entity
         * @access Private - asset:link
         */
        this.router.post('/:id/universe/:universeId', (0, auth_middleware_1.requirePermission)('asset:link'), this._linkToUniverse.bind(this));
        /**
         * @route  DELETE /assets/:id/universe/:universeId
         * @desc   Unlink asset from audit universe entity
         * @access Private - asset:link
         */
        this.router.delete('/:id/universe/:universeId', (0, auth_middleware_1.requirePermission)('asset:link'), this._unlinkFromUniverse.bind(this));
        /**
         * @route  POST /assets/:id/findings/:findingId
         * @desc   Link asset to audit finding
         * @access Private - asset:link
         */
        this.router.post('/:id/findings/:findingId', (0, auth_middleware_1.requirePermission)('asset:link'), (0, validate_middleware_1.validate)(asset_request_dto_1.LinkAssetToFindingRequestSchema), this._linkToFinding.bind(this));
        /**
         * @route  DELETE /assets/:id/findings/:findingId
         * @desc   Unlink asset from audit finding
         * @access Private - asset:link
         */
        this.router.delete('/:id/findings/:findingId', (0, auth_middleware_1.requirePermission)('asset:link'), this._unlinkFromFinding.bind(this));
        /**
         * @route  POST /assets/:id/risks/:riskId
         * @desc   Link asset to risk
         * @access Private - asset:link
         */
        this.router.post('/:id/risks/:riskId', (0, auth_middleware_1.requirePermission)('asset:link'), (0, validate_middleware_1.validate)(asset_request_dto_1.LinkAssetToRiskRequestSchema), this._linkToRisk.bind(this));
        /**
         * @route  DELETE /assets/:id/risks/:riskId
         * @desc   Unlink asset from risk
         * @access Private - asset:link
         */
        this.router.delete('/:id/risks/:riskId', (0, auth_middleware_1.requirePermission)('asset:link'), this._unlinkFromRisk.bind(this));
        /**
         * @route  POST /assets/:id/evidence/:evidenceId
         * @desc   Link asset to audit evidence
         * @access Private - asset:link
         */
        this.router.post('/:id/evidence/:evidenceId', (0, auth_middleware_1.requirePermission)('asset:link'), this._linkToEvidence.bind(this));
        /**
         * @route  DELETE /assets/:id/evidence/:evidenceId
         * @desc   Unlink asset from audit evidence
         * @access Private - asset:link
         */
        this.router.delete('/:id/evidence/:evidenceId', (0, auth_middleware_1.requirePermission)('asset:link'), this._unlinkFromEvidence.bind(this));
    }
    _registerAuditRoutes() {
        this.auditRouter.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /audit/universe/:id/assets
         * @desc   List assets linked to an audit universe entity
         * @access Private - asset:read
         */
        this.auditRouter.get('/universe/:id/assets', (0, auth_middleware_1.requirePermission)('asset:read'), this._listAssetsForUniverse.bind(this));
        /**
         * @route  GET /audit/engagements/:id/assets
         * @desc   List assets in engagement scope
         * @access Private - asset:read
         */
        this.auditRouter.get('/engagements/:id/assets', (0, auth_middleware_1.requirePermission)('asset:read'), this._listAssetsForEngagement.bind(this));
        /**
         * @route  POST /audit/engagements/:id/assets
         * @desc   Add asset to engagement scope
         * @access Private - asset:link
         */
        this.auditRouter.post('/engagements/:id/assets', (0, auth_middleware_1.requirePermission)('asset:link'), (0, validate_middleware_1.validate)(asset_request_dto_1.LinkAssetToEngagementRequestSchema), this._linkToEngagement.bind(this));
        /**
         * @route  DELETE /audit/engagements/:id/assets/:assetId
         * @desc   Remove asset from engagement scope
         * @access Private - asset:link
         */
        this.auditRouter.delete('/engagements/:id/assets/:assetId', (0, auth_middleware_1.requirePermission)('asset:link'), this._unlinkFromEngagement.bind(this));
    }
    async _createAsset(req, res, next) {
        try {
            const asset = await this.assetService.createAsset(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(asset, 'Asset created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateAsset(req, res, next) {
        try {
            const asset = await this.assetService.updateAsset(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(asset, 'Asset updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteAsset(req, res, next) {
        try {
            await this.assetService.deleteAsset(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Asset deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getAssetById(req, res, next) {
        try {
            const asset = await this.assetService.getAssetById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(asset));
        }
        catch (err) {
            next(err);
        }
    }
    async _listAssets(req, res, next) {
        try {
            const result = await this.assetService.listAssets(req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(result.assets, 'Success', result.meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _listRelationships(req, res, next) {
        try {
            const relationships = await this.assetService.listRelationships(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(relationships));
        }
        catch (err) {
            next(err);
        }
    }
    async _createRelationship(req, res, next) {
        try {
            const relationship = await this.assetService.createRelationship(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(relationship, 'Asset relationship created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteRelationship(req, res, next) {
        try {
            await this.assetService.deleteRelationship(req.params.id, req.params.relationshipId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Asset relationship deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _attestAsset(req, res, next) {
        try {
            const attestation = await this.assetService.attestAsset(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(attestation, 'Asset attested'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listAttestations(req, res, next) {
        try {
            const attestations = await this.assetService.listAttestations(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(attestations));
        }
        catch (err) {
            next(err);
        }
    }
    async _createSource(req, res, next) {
        try {
            const source = await this.assetService.createSource(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(source, 'Asset source saved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listSources(req, res, next) {
        try {
            const sources = await this.assetService.listSources(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(sources));
        }
        catch (err) {
            next(err);
        }
    }
    async _getAuditContext(req, res, next) {
        try {
            const context = await this.assetService.getAuditContext(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(context));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkToUniverse(req, res, next) {
        try {
            const link = await this.assetService.linkToUniverse(req.params.id, req.params.universeId, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(link, 'Asset linked to audit universe'));
        }
        catch (err) {
            next(err);
        }
    }
    async _unlinkFromUniverse(req, res, next) {
        try {
            await this.assetService.unlinkFromUniverse(req.params.id, req.params.universeId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Asset unlinked from audit universe'));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkToEngagement(req, res, next) {
        try {
            const link = await this.assetService.linkToEngagement(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(link, 'Asset linked to engagement'));
        }
        catch (err) {
            next(err);
        }
    }
    async _unlinkFromEngagement(req, res, next) {
        try {
            await this.assetService.unlinkFromEngagement(req.params.id, req.params.assetId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Asset unlinked from engagement'));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkToFinding(req, res, next) {
        try {
            const link = await this.assetService.linkToFinding(req.params.id, req.params.findingId, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(link, 'Asset linked to finding'));
        }
        catch (err) {
            next(err);
        }
    }
    async _unlinkFromFinding(req, res, next) {
        try {
            await this.assetService.unlinkFromFinding(req.params.id, req.params.findingId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Asset unlinked from finding'));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkToRisk(req, res, next) {
        try {
            const link = await this.assetService.linkToRisk(req.params.id, req.params.riskId, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(link, 'Asset linked to risk'));
        }
        catch (err) {
            next(err);
        }
    }
    async _unlinkFromRisk(req, res, next) {
        try {
            await this.assetService.unlinkFromRisk(req.params.id, req.params.riskId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Asset unlinked from risk'));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkToEvidence(req, res, next) {
        try {
            const link = await this.assetService.linkToEvidence(req.params.id, req.params.evidenceId, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(link, 'Asset linked to evidence'));
        }
        catch (err) {
            next(err);
        }
    }
    async _unlinkFromEvidence(req, res, next) {
        try {
            await this.assetService.unlinkFromEvidence(req.params.id, req.params.evidenceId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Asset unlinked from evidence'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listAssetsForUniverse(req, res, next) {
        try {
            const assets = await this.assetService.listAssetsForUniverse(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(assets));
        }
        catch (err) {
            next(err);
        }
    }
    async _listAssetsForEngagement(req, res, next) {
        try {
            const assets = await this.assetService.listAssetsForEngagement(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(assets));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AssetController = AssetController;
//# sourceMappingURL=asset.controller.js.map