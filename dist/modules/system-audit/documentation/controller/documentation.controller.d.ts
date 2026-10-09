import { Router } from 'express';
import { ISystemDocumentationService } from '../service/interface/documentation.service.interface';
export declare class SystemDocumentationController {
    private readonly documentationService;
    readonly router: Router;
    constructor(documentationService: ISystemDocumentationService);
    private _registerRoutes;
    private _list;
    private _summary;
    private _create;
    private _get;
    private _update;
    private _remove;
    private _uploadVersion;
    private _download;
}
//# sourceMappingURL=documentation.controller.d.ts.map