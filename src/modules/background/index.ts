// src/modules/background/index.ts
import { Router } from 'express';
import { backgroundJobService } from './service/implementation/job.service';
import { BackgroundJobController } from './controller/job.controller';

export const createBackgroundModule = (): Router => {
  const router = Router();

  // Controllers
  const jobController = new BackgroundJobController(backgroundJobService);

  // Mount
  router.use('/jobs', jobController.router);

  return router;
};

// Re-export for use in other modules
export {
  BackgroundJobService,
  backgroundJobService,
} from './service/implementation/job.service';
export type { IBackgroundJobService } from './service/interface/job.service.interface';
export {
  schedulerService,
  registerAllJobs,
  JOB_KEYS,
} from './service/implementation/scheduler.service';
export type { JobKey } from './service/implementation/scheduler.service';
