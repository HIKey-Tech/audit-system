import { Router } from 'express';
import { DashboardController } from './controller/dashboard.controller';
import { dashboardService } from './service/implementation/dashboard.service';

export const createDashboardModule = (): Router => {
  const router = Router();

  const dashboardController = new DashboardController(dashboardService);

  router.use('/dashboard', dashboardController.router);

  return router;
};

export {
  DashboardService,
  dashboardService,
} from './service/implementation/dashboard.service';
