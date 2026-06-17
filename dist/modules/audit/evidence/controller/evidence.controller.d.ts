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
    private _listRepository;
    private _getRepositoryEvidence;
    private _getDownloadUrl;
}
//# sourceMappingURL=evidence.controller.d.ts.map