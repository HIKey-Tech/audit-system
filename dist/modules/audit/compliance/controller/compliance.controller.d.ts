import { Router } from 'express';
import { IComplianceService } from '../service/interface/compliance.service.interface';
export declare class ComplianceController {
    private readonly complianceService;
    readonly router: Router;
    constructor(complianceService: IComplianceService);
    private _registerRoutes;
    private _getCoverage;
    private _getTestedCoverage;
    private _getRiskCoverage;
    private _listControlRisks;
    private _linkRisk;
    private _unlinkRisk;
    private _listFrameworks;
    private _createFramework;
    private _updateFramework;
    private _listControls;
    private _createControl;
    private _updateControl;
    private _deleteControl;
}
//# sourceMappingURL=compliance.controller.d.ts.map