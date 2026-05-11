import { Router } from 'express';
import { IWorkingPaperTemplateService } from '../service/interface/working-paper-template.service.interface';
export declare class WorkingPaperTemplateController {
    private readonly templateService;
    readonly router: Router;
    constructor(templateService: IWorkingPaperTemplateService);
    private _registerRoutes;
    private _listTemplates;
    private _getDefaultTemplate;
    private _getTemplateById;
    private _createTemplate;
    private _updateTemplate;
    private _setDefaultTemplate;
    private _deactivateTemplate;
}
//# sourceMappingURL=working-paper-template.controller.d.ts.map