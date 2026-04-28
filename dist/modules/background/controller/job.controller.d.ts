import { Router } from 'express';
import { IBackgroundJobService } from '../service/interface/job.service.interface';
export declare class BackgroundJobController {
    private readonly jobService;
    readonly router: Router;
    constructor(jobService: IBackgroundJobService);
    private _registerRoutes;
    private _listJobs;
    private _getJobById;
    private _listRuns;
    private _enableJob;
    private _disableJob;
}
//# sourceMappingURL=job.controller.d.ts.map