import { Router } from 'express';
import { IApprovalService } from '../service/interface/approval.service.interface';
export declare class ApprovalController {
    private readonly approvalService;
    readonly router: Router;
    constructor(approvalService: IApprovalService);
    private _registerRoutes;
    private _getPendingApprovals;
    private _getApprovalByEntity;
    private _getChain;
    private _getApprovalById;
    private _listSignedDocuments;
    private _approve;
    private _reject;
    private _cancel;
}
//# sourceMappingURL=approval.controller.d.ts.map