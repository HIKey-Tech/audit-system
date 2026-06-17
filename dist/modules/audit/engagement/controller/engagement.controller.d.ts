import { Router } from 'express';
import { IEngagementService } from '../service/interface/engagement.service.interface';
export declare class EngagementController {
    private readonly engagementService;
    readonly router: Router;
    constructor(engagementService: IEngagementService);
    private _registerRoutes;
    private _createFromPlanItem;
    private _createAdhoc;
    private _updateEngagement;
    private _updateStatus;
    private _getEligibleUsers;
    private _getEngagementById;
    private _listEngagements;
}
//# sourceMappingURL=engagement.controller.d.ts.map