import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import {
  AssetQuerySchema,
  CreateAssetAttestationRequestSchema,
  CreateAssetRelationshipRequestSchema,
  CreateAssetRequestSchema,
  CreateAssetSourceRequestSchema,
  LinkAssetToEngagementRequestSchema,
  LinkAssetToFindingRequestSchema,
  LinkAssetToRiskRequestSchema,
  UpdateAssetRequestSchema,
} from '../dto/request/asset.request.dto';
import { IAssetService } from '../service/interface/asset.service.interface';

export class AssetController {
  public readonly router: Router;
  public readonly auditRouter: Router;

  constructor(private readonly assetService: IAssetService) {
    this.router = Router();
    this.auditRouter = Router();
    this._registerRoutes();
    this._registerAuditRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /assets
     * @desc   List assets
     * @access Private - asset:read
     */
    this.router.get('/', requirePermission('asset:read'), validate(AssetQuerySchema, 'query'), this._listAssets.bind(this));

    /**
     * @route  POST /assets
     * @desc   Create asset
     * @access Private - asset:create
     */
    this.router.post('/', requirePermission('asset:create'), validate(CreateAssetRequestSchema), this._createAsset.bind(this));

    /**
     * @route  GET /assets/:id
     * @desc   Get asset detail
     * @access Private - asset:read
     */
    this.router.get('/:id', requirePermission('asset:read'), this._getAssetById.bind(this));

    /**
     * @route  PATCH /assets/:id
     * @desc   Update asset
     * @access Private - asset:update
     */
    this.router.patch('/:id', requirePermission('asset:update'), validate(UpdateAssetRequestSchema), this._updateAsset.bind(this));

    /**
     * @route  DELETE /assets/:id
     * @desc   Soft-delete asset
     * @access Private - asset:delete
     */
    this.router.delete('/:id', requirePermission('asset:delete'), this._deleteAsset.bind(this));

    /**
     * @route  GET /assets/:id/relationships
     * @desc   List asset relationships
     * @access Private - asset:read
     */
    this.router.get('/:id/relationships', requirePermission('asset:read'), this._listRelationships.bind(this));

    /**
     * @route  POST /assets/:id/relationships
     * @desc   Create asset relationship
     * @access Private - asset:update
     */
    this.router.post('/:id/relationships', requirePermission('asset:update'), validate(CreateAssetRelationshipRequestSchema), this._createRelationship.bind(this));

    /**
     * @route  DELETE /assets/:id/relationships/:relationshipId
     * @desc   Delete asset relationship
     * @access Private - asset:update
     */
    this.router.delete('/:id/relationships/:relationshipId', requirePermission('asset:update'), this._deleteRelationship.bind(this));

    /**
     * @route  GET /assets/:id/attestations
     * @desc   List asset attestations
     * @access Private - asset:read
     */
    this.router.get('/:id/attestations', requirePermission('asset:read'), this._listAttestations.bind(this));

    /**
     * @route  POST /assets/:id/attest
     * @desc   Attest asset accuracy
     * @access Private - asset:attest
     */
    this.router.post('/:id/attest', requirePermission('asset:attest'), validate(CreateAssetAttestationRequestSchema), this._attestAsset.bind(this));

    /**
     * @route  GET /assets/:id/sources
     * @desc   List asset source records
     * @access Private - asset:read
     */
    this.router.get('/:id/sources', requirePermission('asset:read'), this._listSources.bind(this));

    /**
     * @route  POST /assets/:id/sources
     * @desc   Upsert asset source record
     * @access Private - asset:admin
     */
    this.router.post('/:id/sources', requirePermission('asset:admin'), validate(CreateAssetSourceRequestSchema), this._createSource.bind(this));

    /**
     * @route  GET /assets/:id/audit-context
     * @desc   Get audit/risk/evidence links for an asset
     * @access Private - asset:read
     */
    this.router.get('/:id/audit-context', requirePermission('asset:read'), this._getAuditContext.bind(this));

    /**
     * @route  POST /assets/:id/universe/:universeId
     * @desc   Link asset to audit universe entity
     * @access Private - asset:link
     */
    this.router.post('/:id/universe/:universeId', requirePermission('asset:link'), this._linkToUniverse.bind(this));

    /**
     * @route  DELETE /assets/:id/universe/:universeId
     * @desc   Unlink asset from audit universe entity
     * @access Private - asset:link
     */
    this.router.delete('/:id/universe/:universeId', requirePermission('asset:link'), this._unlinkFromUniverse.bind(this));

    /**
     * @route  POST /assets/:id/findings/:findingId
     * @desc   Link asset to audit finding
     * @access Private - asset:link
     */
    this.router.post('/:id/findings/:findingId', requirePermission('asset:link'), validate(LinkAssetToFindingRequestSchema), this._linkToFinding.bind(this));

    /**
     * @route  DELETE /assets/:id/findings/:findingId
     * @desc   Unlink asset from audit finding
     * @access Private - asset:link
     */
    this.router.delete('/:id/findings/:findingId', requirePermission('asset:link'), this._unlinkFromFinding.bind(this));

    /**
     * @route  POST /assets/:id/risks/:riskId
     * @desc   Link asset to risk
     * @access Private - asset:link
     */
    this.router.post('/:id/risks/:riskId', requirePermission('asset:link'), validate(LinkAssetToRiskRequestSchema), this._linkToRisk.bind(this));

    /**
     * @route  DELETE /assets/:id/risks/:riskId
     * @desc   Unlink asset from risk
     * @access Private - asset:link
     */
    this.router.delete('/:id/risks/:riskId', requirePermission('asset:link'), this._unlinkFromRisk.bind(this));

    /**
     * @route  POST /assets/:id/evidence/:evidenceId
     * @desc   Link asset to audit evidence
     * @access Private - asset:link
     */
    this.router.post('/:id/evidence/:evidenceId', requirePermission('asset:link'), this._linkToEvidence.bind(this));

    /**
     * @route  DELETE /assets/:id/evidence/:evidenceId
     * @desc   Unlink asset from audit evidence
     * @access Private - asset:link
     */
    this.router.delete('/:id/evidence/:evidenceId', requirePermission('asset:link'), this._unlinkFromEvidence.bind(this));
  }

  private _registerAuditRoutes(): void {
    this.auditRouter.use(authenticate);

    /**
     * @route  GET /audit/universe/:id/assets
     * @desc   List assets linked to an audit universe entity
     * @access Private - asset:read
     */
    this.auditRouter.get('/universe/:id/assets', requirePermission('asset:read'), this._listAssetsForUniverse.bind(this));

    /**
     * @route  GET /audit/engagements/:id/assets
     * @desc   List assets in engagement scope
     * @access Private - asset:read
     */
    this.auditRouter.get('/engagements/:id/assets', requirePermission('asset:read'), this._listAssetsForEngagement.bind(this));

    /**
     * @route  POST /audit/engagements/:id/assets
     * @desc   Add asset to engagement scope
     * @access Private - asset:link
     */
    this.auditRouter.post('/engagements/:id/assets', requirePermission('asset:link'), validate(LinkAssetToEngagementRequestSchema), this._linkToEngagement.bind(this));

    /**
     * @route  DELETE /audit/engagements/:id/assets/:assetId
     * @desc   Remove asset from engagement scope
     * @access Private - asset:link
     */
    this.auditRouter.delete('/engagements/:id/assets/:assetId', requirePermission('asset:link'), this._unlinkFromEngagement.bind(this));
  }

  private async _createAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await this.assetService.createAsset(req.body, req.user!);
      res.status(201).json(buildResponse(asset, 'Asset created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await this.assetService.updateAsset(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(asset, 'Asset updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deleteAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.assetService.deleteAsset(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Asset deleted'));
    } catch (err) {
      next(err);
    }
  }

  private async _getAssetById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await this.assetService.getAssetById(req.params.id, req.user!);
      res.status(200).json(buildResponse(asset));
    } catch (err) {
      next(err);
    }
  }

  private async _listAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.assetService.listAssets(req.query as never, req.user!);
      res.status(200).json(buildResponse(result.assets, 'Success', result.meta));
    } catch (err) {
      next(err);
    }
  }

  private async _listRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const relationships = await this.assetService.listRelationships(req.params.id, req.user!);
      res.status(200).json(buildResponse(relationships));
    } catch (err) {
      next(err);
    }
  }

  private async _createRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const relationship = await this.assetService.createRelationship(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(relationship, 'Asset relationship created'));
    } catch (err) {
      next(err);
    }
  }

  private async _deleteRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.assetService.deleteRelationship(req.params.id, req.params.relationshipId, req.user!);
      res.status(200).json(buildResponse(null, 'Asset relationship deleted'));
    } catch (err) {
      next(err);
    }
  }

  private async _attestAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const attestation = await this.assetService.attestAsset(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(attestation, 'Asset attested'));
    } catch (err) {
      next(err);
    }
  }

  private async _listAttestations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const attestations = await this.assetService.listAttestations(req.params.id, req.user!);
      res.status(200).json(buildResponse(attestations));
    } catch (err) {
      next(err);
    }
  }

  private async _createSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const source = await this.assetService.createSource(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(source, 'Asset source saved'));
    } catch (err) {
      next(err);
    }
  }

  private async _listSources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sources = await this.assetService.listSources(req.params.id, req.user!);
      res.status(200).json(buildResponse(sources));
    } catch (err) {
      next(err);
    }
  }

  private async _getAuditContext(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = await this.assetService.getAuditContext(req.params.id, req.user!);
      res.status(200).json(buildResponse(context));
    } catch (err) {
      next(err);
    }
  }

  private async _linkToUniverse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.assetService.linkToUniverse(req.params.id, req.params.universeId, req.user!);
      res.status(201).json(buildResponse(link, 'Asset linked to audit universe'));
    } catch (err) {
      next(err);
    }
  }

  private async _unlinkFromUniverse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.assetService.unlinkFromUniverse(req.params.id, req.params.universeId, req.user!);
      res.status(200).json(buildResponse(null, 'Asset unlinked from audit universe'));
    } catch (err) {
      next(err);
    }
  }

  private async _linkToEngagement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.assetService.linkToEngagement(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(link, 'Asset linked to engagement'));
    } catch (err) {
      next(err);
    }
  }

  private async _unlinkFromEngagement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.assetService.unlinkFromEngagement(req.params.id, req.params.assetId, req.user!);
      res.status(200).json(buildResponse(null, 'Asset unlinked from engagement'));
    } catch (err) {
      next(err);
    }
  }

  private async _linkToFinding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.assetService.linkToFinding(req.params.id, req.params.findingId, req.body, req.user!);
      res.status(201).json(buildResponse(link, 'Asset linked to finding'));
    } catch (err) {
      next(err);
    }
  }

  private async _unlinkFromFinding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.assetService.unlinkFromFinding(req.params.id, req.params.findingId, req.user!);
      res.status(200).json(buildResponse(null, 'Asset unlinked from finding'));
    } catch (err) {
      next(err);
    }
  }

  private async _linkToRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.assetService.linkToRisk(req.params.id, req.params.riskId, req.body, req.user!);
      res.status(201).json(buildResponse(link, 'Asset linked to risk'));
    } catch (err) {
      next(err);
    }
  }

  private async _unlinkFromRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.assetService.unlinkFromRisk(req.params.id, req.params.riskId, req.user!);
      res.status(200).json(buildResponse(null, 'Asset unlinked from risk'));
    } catch (err) {
      next(err);
    }
  }

  private async _linkToEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.assetService.linkToEvidence(req.params.id, req.params.evidenceId, req.user!);
      res.status(201).json(buildResponse(link, 'Asset linked to evidence'));
    } catch (err) {
      next(err);
    }
  }

  private async _unlinkFromEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.assetService.unlinkFromEvidence(req.params.id, req.params.evidenceId, req.user!);
      res.status(200).json(buildResponse(null, 'Asset unlinked from evidence'));
    } catch (err) {
      next(err);
    }
  }

  private async _listAssetsForUniverse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assets = await this.assetService.listAssetsForUniverse(req.params.id, req.user!);
      res.status(200).json(buildResponse(assets));
    } catch (err) {
      next(err);
    }
  }

  private async _listAssetsForEngagement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assets = await this.assetService.listAssetsForEngagement(req.params.id, req.user!);
      res.status(200).json(buildResponse(assets));
    } catch (err) {
      next(err);
    }
  }
}
