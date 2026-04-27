import { Router } from 'express';
import { IFindingService } from '../service/interface/finding.service.interface';
export declare class FindingController {
    private readonly findingService;
    readonly router: Router;
    constructor(findingService: IFindingService);
    private _registerRoutes;
    private _createFinding;
    private _updateFinding;
    private _updateFindingStatus;
    private _closeFinding;
    private _getFindingById;
    private _listFindings;
}
//# sourceMappingURL=finding.controller.d.ts.map