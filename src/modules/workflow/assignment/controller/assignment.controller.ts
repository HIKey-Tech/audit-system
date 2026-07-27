import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  AssignStaffRequestSchema,
  MyAssignmentsQuerySchema,
} from '../dto/request/assignment.request.dto';
import { IAssignmentService } from '../service/interface/assignment.service.interface';

export class AssignmentController {
  public readonly router: Router;

  constructor(private readonly assignmentService: IAssignmentService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /workflow/assignments
     * @desc   Assign staff to an engagement
     * @access Private - audit:write
     */
    this.router.post('/', requirePermission('assignment:create'), validate(AssignStaffRequestSchema), this._assignStaff.bind(this));

    /**
     * @route  GET /workflow/assignments/engagement/:id
     * @desc   Get engagement assignments
     * @access Private - audit:read
     */
    this.router.get('/engagement/:id', requirePermission('assignment:read'), this._getAssignments.bind(this));

    /**
     * @route  GET /workflow/assignments/mine
     * @desc   Get current user's assignments
     * @access Private - audit:read
     */
    this.router.get('/mine', requirePermission('assignment:read'), validate(MyAssignmentsQuerySchema, 'query'), this._getMyAssignments.bind(this));

    /**
     * @route  GET /workflow/assignments
     * @desc   Assignments the caller can manage — oversight sees all; a lead/manager
     *         sees assignments on engagements they run. Backs the Assignments page.
     * @access Private - assignment:read
     */
    this.router.get('/', requirePermission('assignment:read'), this._getVisibleAssignments.bind(this));

    /**
     * @route  GET /workflow/assignments/workload/:userId
     * @desc   Get user workload
     * @access Private - audit:read
     */
    this.router.get('/workload/:userId', requirePermission('assignment:read'), this._getUserWorkload.bind(this));

    /**
     * @route  DELETE /workflow/assignments/:id
     * @desc   Remove assignment
     * @access Private - audit:write
     */
    this.router.delete('/:id', requirePermission('assignment:delete'), this._removeAssignment.bind(this));

    /**
     * @route  GET /workflow/assignments/candidates/:engagementId
     * @desc   Get candidate users for engagement assignment with skills and workload
     * @access Private - assignment:create
     */
    this.router.get('/candidates/:engagementId', requirePermission('assignment:create'), this._getCandidates.bind(this));
  }

  private async _assignStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignment = await this.assignmentService.assignStaff(req.body, req.user!);
      res.status(201).json(buildResponse(assignment, 'Staff assigned'));
    } catch (err) {
      next(err);
    }
  }

  private async _getAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignments = await this.assignmentService.getAssignments(req.params.id, req.user!);
      res.status(200).json(buildResponse(assignments));
    } catch (err) {
      next(err);
    }
  }

  private async _getMyAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignments, meta } = await this.assignmentService.getMyAssignments(req.user!.id, req.query as never);
      res.status(200).json(buildResponse(assignments, 'Assignments retrieved', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _getVisibleAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignments = await this.assignmentService.getVisibleAssignments(req.user!);
      res.status(200).json(buildResponse(assignments, 'Assignments retrieved'));
    } catch (err) {
      next(err);
    }
  }

  private async _getUserWorkload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workload = await this.assignmentService.getUserWorkload(req.params.userId);
      res.status(200).json(buildResponse(workload));
    } catch (err) {
      next(err);
    }
  }

  private async _removeAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.assignmentService.removeAssignment(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Assignment removed'));
    } catch (err) {
      next(err);
    }
  }

  private async _getCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
      const candidates = await this.assignmentService.getCandidates(
        req.params.engagementId,
        req.user!,
        { search, limit: Number.isFinite(limitRaw) ? limitRaw : undefined },
      );
      res.json(buildResponse(candidates, 'Candidates retrieved'));
    } catch (err) {
      next(err);
    }
  }
}
