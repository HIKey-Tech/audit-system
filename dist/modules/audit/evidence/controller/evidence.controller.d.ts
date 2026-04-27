import { Router } from 'express';
import { IEvidenceService } from '../service/interface/evidence.service.interface';
export declare class EvidenceController {
    private readonly evidenceService;
    readonly router: Router;
    constructor(evidenceService: IEvidenceService);
    private _registerRoutes;
    private _uploadEvidence;
    private _linkToWorkingPaper;
    private _linkToFinding;
    private _disputeEvidence;
    private _listEvidence;
}
//# sourceMappingURL=evidence.controller.d.ts.map