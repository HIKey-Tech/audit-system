import { Router } from 'express';
import { IFollowUpService } from '../service/interface/follow-up.service.interface';
export declare class FollowUpController {
    private readonly followUpService;
    readonly router: Router;
    constructor(followUpService: IFollowUpService);
    private _registerRoutes;
    private _submitManagementResponse;
    private _submitRemediationEvidence;
    private _verifyRemediation;
    private _getFollowUp;
    private _listPendingFollowUps;
}
//# sourceMappingURL=follow-up.controller.d.ts.map