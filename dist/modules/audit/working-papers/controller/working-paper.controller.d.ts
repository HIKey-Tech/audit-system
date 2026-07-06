import { Router } from 'express';
import { IWorkingPaperService } from '../service/interface/working-paper.service.interface';
export declare class WorkingPaperController {
    private readonly workingPaperService;
    readonly router: Router;
    constructor(workingPaperService: IWorkingPaperService);
    private _registerRoutes;
    private _createWorkingPaper;
    private _previewWorkingPaperImport;
    private _updateWorkingPaper;
    private _submitWorkingPaper;
    private _approveWorkingPaper;
    private _addComment;
    private _listComments;
    private _resolveComment;
    private _rejectWorkingPaper;
    private _getWorkingPaperById;
    private _listWorkingPapers;
    private _exportWorkingPaper;
}
//# sourceMappingURL=working-paper.controller.d.ts.map