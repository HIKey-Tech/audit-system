import { Router } from 'express';
import { IEvidenceRequestService } from '../service/interface/evidence-request.service.interface';
export declare class EvidenceRequestController {
    private readonly evidenceRequestService;
    readonly router: Router;
    constructor(evidenceRequestService: IEvidenceRequestService);
    private _registerRoutes;
    private _create;
    private _listForEngagement;
    private _listMine;
    private _respond;
    private _accept;
    private _return;
    private _cancel;
}
//# sourceMappingURL=evidence-request.controller.d.ts.map