import { Router } from 'express';
import { AssetController } from './controller/asset.controller';
import { assetService } from './service/implementation/asset.service';

export const createAssetModule = (): Router => {
  const router = Router();
  const assetController = new AssetController(assetService);

  router.use('/assets', assetController.router);
  router.use('/audit', assetController.auditRouter);

  return router;
};

export { AssetService, assetService } from './service/implementation/asset.service';
export type { IAssetService } from './service/interface/asset.service.interface';
