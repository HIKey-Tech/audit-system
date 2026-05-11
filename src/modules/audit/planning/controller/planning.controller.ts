import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  AddPlanItemRequestSchema,
  CreatePlanRequestSchema,
  PlanQuerySchema,
  RejectPlanRequestSchema,
} from '../dto/request/planning.request.dto';
import { IPlanningService } from '../service/interface/planning.service.interface';

export class PlanningController {
  public readonly router: Router;

  constructor(private readonly planningService: IPlanningService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/plans
     * @desc   Create annual audit plan
     * @access Private - audit:write
     */
    this.router.post('/', requirePermission('plan:create'), validate(CreatePlanRequestSchema), this._createPlan.bind(this));

    /**
     * @route  GET /audit/plans
     * @desc   List audit plans
     * @access Private - audit:read
     */
    this.router.get('/', requirePermission('plan:read'), validate(PlanQuerySchema, 'query'), this._listPlans.bind(this));

    /**
     * @route  GET /audit/plans/:id
     * @desc   Get audit plan
     * @access Private - audit:read
     */
    this.router.get('/:id', requirePermission('plan:read'), this._getPlanById.bind(this));

    /**
     * @route  POST /audit/plans/:id/items
     * @desc   Add audit plan item
     * @access Private - audit:write
     */
    this.router.post('/:id/items', requirePermission('plan:add_item'), validate(AddPlanItemRequestSchema), this._addPlanItem.bind(this));

    /**
     * @route  DELETE /audit/plans/:id/items/:itemId
     * @desc   Remove audit plan item
     * @access Private - audit:write
     */
    this.router.delete('/:id/items/:itemId', requirePermission('plan:add_item'), this._removePlanItem.bind(this));

    /**
     * @route  POST /audit/plans/:id/submit
     * @desc   Submit plan for approval
     * @access Private - audit:write
     */
    this.router.post('/:id/submit', requirePermission('plan:submit'), this._submitPlanForApproval.bind(this));

    /**
     * @route  POST /audit/plans/:id/approve
     * @desc   Approve audit plan
     * @access Private - audit:admin
     */
    this.router.post('/:id/approve', requirePermission('plan:approve'), this._approvePlan.bind(this));

    /**
     * @route  POST /audit/plans/:id/reject
     * @desc   Reject audit plan
     * @access Private - audit:admin
     */
    this.router.post('/:id/reject', requirePermission('plan:reject'), validate(RejectPlanRequestSchema), this._rejectPlan.bind(this));
  }

  private async _createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.createPlan(req.body, req.user!);
      res.status(201).json(buildResponse(plan, 'Audit plan created'));
    } catch (err) {
      next(err);
    }
  }

  private async _addPlanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.addPlanItem(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(plan, 'Audit plan item added'));
    } catch (err) {
      next(err);
    }
  }

  private async _removePlanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.planningService.removePlanItem(req.params.id, req.params.itemId, req.user!);
      res.status(200).json(buildResponse(null, 'Audit plan item removed'));
    } catch (err) {
      next(err);
    }
  }

  private async _submitPlanForApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.submitPlanForApproval(req.params.id, req.user!);
      res.status(200).json(buildResponse(plan, 'Audit plan submitted'));
    } catch (err) {
      next(err);
    }
  }

  private async _approvePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.approvePlan(req.params.id, req.user!);
      res.status(200).json(buildResponse(plan, 'Audit plan approved'));
    } catch (err) {
      next(err);
    }
  }

  private async _rejectPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.rejectPlan(req.params.id, req.body.reason, req.user!);
      res.status(200).json(buildResponse(plan, 'Audit plan rejected'));
    } catch (err) {
      next(err);
    }
  }

  private async _getPlanById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.getPlanById(req.params.id);
      res.status(200).json(buildResponse(plan));
    } catch (err) {
      next(err);
    }
  }

  private async _listPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { plans, meta } = await this.planningService.listPlans(req.query as never);
      res.status(200).json({ ...buildResponse(plans), meta });
    } catch (err) {
      next(err);
    }
  }
}
