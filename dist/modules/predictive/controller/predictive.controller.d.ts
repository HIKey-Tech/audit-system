import { Router } from 'express';
import { PredictiveService } from '../service/implementation/predictive.service';
export declare class PredictiveController {
    private readonly predictiveService;
    readonly router: Router;
    constructor(predictiveService: PredictiveService);
    private _registerRoutes;
    private _getOverview;
    private _recordFeedback;
}
//# sourceMappingURL=predictive.controller.d.ts.map