import { Router } from 'express';
import { IReportTemplateService } from '../service/interface/report-template.service.interface';
export declare class ReportTemplateController {
    private readonly templateService;
    readonly router: Router;
    constructor(templateService: IReportTemplateService);
    private _registerRoutes;
    private _listTemplates;
    private _getDefaultTemplate;
    private _getAvailableVariables;
    private _getTemplateById;
    private _createTemplate;
    private _updateTemplate;
    private _setDefaultTemplate;
    private _deactivateTemplate;
}
//# sourceMappingURL=report-template.controller.d.ts.map