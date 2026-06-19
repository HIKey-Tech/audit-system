import { Router } from 'express';
import { IRequestService } from '../service/interface/request.service.interface';
export declare class RequestController {
    private readonly requestService;
    readonly router: Router;
    constructor(requestService: IRequestService);
    private _registerRoutes;
    private _getCandidates;
    private _inbox;
    private _list;
    private _create;
    private _addAttachment;
    private _getById;
    private _verifySignatures;
    private _listSignedDocuments;
    private _approve;
    private _sign;
    private _reject;
    private _comment;
    private _cancel;
}
//# sourceMappingURL=request.controller.d.ts.map