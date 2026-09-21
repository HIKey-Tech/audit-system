import { Router } from 'express';
import { PredictiveController } from './controller/predictive.controller';
import { warehouseService } from '../warehouse/service/implementation/warehouse.service';
import { PredictiveService } from './service/implementation/predictive.service';

// The predictive module only consumes warehouse-service methods. It does not
// query audit/workflow tables directly, preserving the modular-monolith
// boundary as the prediction engine grows.
export const predictiveService = new PredictiveService(warehouseService);

export const createPredictiveModule = (): Router => {
  const router = Router();
  const predictiveController = new PredictiveController(predictiveService);
  router.use('/predictive', predictiveController.router);
  return router;
};

export { PredictiveService } from './service/implementation/predictive.service';
