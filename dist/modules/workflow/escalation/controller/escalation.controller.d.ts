import { Router } from 'express';
import { IEscalationService } from '../service/interface/escalation.service.interface';
export declare class EscalationController {
    private readonly escalationService;
    readonly router: Router;
    constructor(escalationService: IEscalationService);
    private _registerRoutes;
    private _getEscalationHistory;
    private _acknowledgeEscalation;
    private _listEscalationPolicies;
    private _createOrUpdateEscalationPolicy;
}
//# sourceMappingURL=escalation.controller.d.ts.map