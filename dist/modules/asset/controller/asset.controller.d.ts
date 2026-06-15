import { Router } from 'express';
import { IAssetService } from '../service/interface/asset.service.interface';
export declare class AssetController {
    private readonly assetService;
    readonly router: Router;
    readonly auditRouter: Router;
    constructor(assetService: IAssetService);
    private _registerRoutes;
    private _registerAuditRoutes;
    private _createAsset;
    private _updateAsset;
    private _deleteAsset;
    private _getAssetById;
    private _listAssets;
    private _listRelationships;
    private _createRelationship;
    private _deleteRelationship;
    private _attestAsset;
    private _listAttestations;
    private _createSource;
    private _listSources;
    private _getAuditContext;
    private _linkToUniverse;
    private _unlinkFromUniverse;
    private _linkToEngagement;
    private _unlinkFromEngagement;
    private _linkToFinding;
    private _unlinkFromFinding;
    private _linkToRisk;
    private _unlinkFromRisk;
    private _linkToEvidence;
    private _unlinkFromEvidence;
    private _listAssetsForUniverse;
    private _listAssetsForEngagement;
}
//# sourceMappingURL=asset.controller.d.ts.map