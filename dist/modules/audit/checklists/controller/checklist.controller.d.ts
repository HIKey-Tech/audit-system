import { Router } from 'express';
import { IChecklistService } from '../service/interface/checklist.service.interface';
export declare class ChecklistController {
    private readonly checklistService;
    readonly router: Router;
    constructor(checklistService: IChecklistService);
    private _registerRoutes;
    private _getChecklistTemplates;
    private _updateChecklistTemplates;
    private _previewChecklistControls;
    private _getChecklists;
    private _getChecklistProgress;
    private _createChecklistItem;
    private _updateChecklistItem;
    private _linkEvidenceToChecklistItem;
}
//# sourceMappingURL=checklist.controller.d.ts.map