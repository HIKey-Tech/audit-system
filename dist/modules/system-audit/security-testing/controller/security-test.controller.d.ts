import { Router } from 'express';
import { ISecurityTestService } from '../service/interface/security-test.service.interface';
export declare class SecurityTestController {
    private readonly securityTestService;
    readonly router: Router;
    constructor(securityTestService: ISecurityTestService);
    private _registerRoutes;
    private _list;
    private _create;
    private _get;
    private _update;
    private _delete;
    private _authorise;
    private _changeStatus;
    private _addAssets;
    private _removeAsset;
    private _uploadReport;
    private _downloadReport;
}
//# sourceMappingURL=security-test.controller.d.ts.map