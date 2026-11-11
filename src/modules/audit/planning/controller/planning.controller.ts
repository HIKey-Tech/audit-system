import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  AddPlanItemRequestSchema,
  BulkAddPlanItemsRequestSchema,
  CreatePlanRequestSchema,
  PlanQuerySchema,
  RejectPlanRequestSchema,
  UpdatePlanItemRequestSchema,
  UpdatePlanRequestSchema,
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
     * @access Private - plan:create
     */
    this.router.post('/', requirePermission('plan:create'), validate(CreatePlanRequestSchema), this._createPlan.bind(this));

    /**
     * @route  GET /audit/plans
     * @desc   List audit plans
     * @access Private - plan:read
     */
    this.router.get('/', requirePermission('plan:read'), validate(PlanQuerySchema, 'query'), this._listPlans.bind(this));

    /**
     * @route  GET /audit/plans/recommendations
     * @desc   Composite audit-priority ranking of universe entities (risk score,
     *         open findings, audit overdue, never audited, time since last audit)
     *         with configurable weights — registered before /:id
     * @access Private - plan:read
     */
    this.router.get('/recommendations', requirePermission('plan:read'), this._getRecommendations.bind(this));

    /**
     * @route  GET /audit/plans/:id/universe-candidates
     * @desc   List active universe entities with due-cycle classification & coverage for this programme year
     * @access Private - plan:read
     */
    this.router.get('/:id/universe-candidates', requirePermission('plan:read'), this._getUniverseCandidates.bind(this));

    /**
     * @route  GET /audit/plans/:id
     * @desc   Get audit plan
     * @access Private - plan:read
     */
    this.router.get('/:id', requirePermission('plan:read'), this._getPlanById.bind(this));

    /**
     * @route  PUT /audit/plans/:id
     * @desc   Update draft audit plan
     * @access Private - plan:update
     */
    this.router.put('/:id', requirePermission('plan:update'), validate(UpdatePlanRequestSchema), this._updatePlan.bind(this));

    /**
     * @route  DELETE /audit/plans/:id
     * @desc   Delete draft audit plan
     * @access Private - plan:update
     */
    this.router.delete('/:id', requirePermission('plan:update'), this._deletePlan.bind(this));

    /**
     * @route  POST /audit/plans/:id/items/bulk
     * @desc   Bulk-import multiple universe entities into a draft/rejected audit plan
     * @access Private - plan:add_item
     */
    this.router.post('/:id/items/bulk', requirePermission('plan:add_item'), validate(BulkAddPlanItemsRequestSchema), this._bulkAddPlanItems.bind(this));

    /**
     * @route  POST /audit/plans/:id/items
     * @desc   Add audit plan item
     * @access Private - plan:add_item
     */
    this.router.post('/:id/items', requirePermission('plan:add_item'), validate(AddPlanItemRequestSchema), this._addPlanItem.bind(this));

    /**
     * @route  PUT /audit/plans/:id/items/:itemId
     * @desc   Update audit plan item
     * @access Private - plan:add_item
     */
    this.router.put('/:id/items/:itemId', requirePermission('plan:add_item'), validate(UpdatePlanItemRequestSchema), this._updatePlanItem.bind(this));

    /**
     * @route  DELETE /audit/plans/:id/items/:itemId
     * @desc   Remove audit plan item
     * @access Private - plan:add_item
     */
    this.router.delete('/:id/items/:itemId', requirePermission('plan:add_item'), this._removePlanItem.bind(this));

    /**
     * @route  POST /audit/plans/:id/submit
     * @desc   Submit plan for approval
     * @access Private - plan:submit
     */
    this.router.post('/:id/submit', requirePermission('plan:submit'), this._submitPlanForApproval.bind(this));

    /**
     * @route  POST /audit/plans/:id/approve
     * @desc   Approve audit plan
     * @access Private - plan:approve
     */
    this.router.post('/:id/approve', requirePermission('plan:approve'), this._approvePlan.bind(this));

    /**
     * @route  POST /audit/plans/:id/reject
     * @desc   Reject audit plan
     * @access Private - plan:reject
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

  private async _bulkAddPlanItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.bulkAddPlanItems(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(plan, 'Audit plan items added'));
    } catch (err) {
      next(err);
    }
  }

  private async _updatePlanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.updatePlanItem(req.params.id, req.params.itemId, req.body, req.user!);
      res.status(200).json(buildResponse(plan, 'Audit plan item updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.planningService.updatePlan(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(plan, 'Audit plan updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deletePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.planningService.deletePlan(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Audit plan deleted'));
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

  private async _getUniverseCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const candidates = await this.planningService.getUniverseCandidates(req.params.id);
      res.status(200).json(buildResponse(candidates));
    } catch (err) {
      next(err);
    }
  }

  private async _getRecommendations(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const recommendations = await this.planningService.getRecommendations();
      res.status(200).json(buildResponse(recommendations));
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
