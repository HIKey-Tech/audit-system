import { Router } from 'express';
import { IRegisterService } from '../service/interface/register.service.interface';
export declare class RegisterController {
    private readonly registerService;
    readonly router: Router;
    constructor(registerService: IRegisterService);
    private _registerRoutes;
    private _createRisk;
    private _updateRisk;
    private _updateRiskStatus;
    private _deleteRisk;
    private _getRiskById;
    private _listRisks;
    private _getRisksByUniverseEntity;
}
//# sourceMappingURL=register.controller.d.ts.map