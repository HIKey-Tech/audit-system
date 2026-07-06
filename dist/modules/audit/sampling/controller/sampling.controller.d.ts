import { Router } from 'express';
import { ISamplingService } from '../service/interface/sampling.service.interface';
export declare class SamplingController {
    private readonly samplingService;
    readonly router: Router;
    constructor(samplingService: ISamplingService);
    private _registerRoutes;
    private _runSampling;
}
//# sourceMappingURL=sampling.controller.d.ts.map