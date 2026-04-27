import { Router } from 'express';
import { IPlanningService } from '../service/interface/planning.service.interface';
export declare class PlanningController {
    private readonly planningService;
    readonly router: Router;
    constructor(planningService: IPlanningService);
    private _registerRoutes;
    private _createPlan;
    private _addPlanItem;
    private _removePlanItem;
    private _submitPlanForApproval;
    private _approvePlan;
    private _rejectPlan;
    private _getPlanById;
    private _listPlans;
}
//# sourceMappingURL=planning.controller.d.ts.map