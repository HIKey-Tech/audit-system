import { Router } from 'express';
export declare const createBackgroundModule: () => Router;
export { BackgroundJobService, backgroundJobService, } from './service/implementation/job.service';
export type { IBackgroundJobService } from './service/interface/job.service.interface';
export { schedulerService, registerAllJobs, JOB_KEYS, } from './service/implementation/scheduler.service';
export type { JobKey } from './service/implementation/scheduler.service';
//# sourceMappingURL=index.d.ts.map