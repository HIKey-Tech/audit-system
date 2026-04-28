import { Router } from 'express';
import { IAssignmentService } from '../service/interface/assignment.service.interface';
export declare class AssignmentController {
    private readonly assignmentService;
    readonly router: Router;
    constructor(assignmentService: IAssignmentService);
    private _registerRoutes;
    private _assignStaff;
    private _getAssignments;
    private _getMyAssignments;
    private _getUserWorkload;
    private _removeAssignment;
}
//# sourceMappingURL=assignment.controller.d.ts.map