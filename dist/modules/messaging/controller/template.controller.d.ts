import { Router } from 'express';
import { ITemplateService } from '../service/interface/template.service.interface';
export declare class TemplateController {
    private readonly templateService;
    readonly router: Router;
    constructor(templateService: ITemplateService);
    private _registerRoutes;
    private _listTemplates;
    private _getTemplateById;
    private _createTemplate;
    private _updateTemplate;
    private _deactivateTemplate;
}
//# sourceMappingURL=template.controller.d.ts.map