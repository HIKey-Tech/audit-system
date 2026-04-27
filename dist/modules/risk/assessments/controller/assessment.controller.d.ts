import { Router } from 'express';
import { IAssessmentService } from '../service/interface/assessment.service.interface';
export declare class AssessmentController {
    private readonly assessmentService;
    readonly router: Router;
    constructor(assessmentService: IAssessmentService);
    private _registerRoutes;
    private _createAssessment;
    private _getAssessmentById;
    private _listAssessments;
    private _getLatestAssessment;
}
//# sourceMappingURL=assessment.controller.d.ts.map