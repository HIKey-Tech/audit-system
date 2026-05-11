import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  CreateAdhocEngagementRequestSchema,
  CreateEngagementFromPlanRequestSchema,
  EngagementQuerySchema,
  UpdateEngagementRequestSchema,
  UpdateEngagementStatusRequestSchema,
} from '../dto/request/engagement.request.dto';
import { IEngagementService } from '../service/interface/engagement.service.interface';

export class EngagementController {
  public readonly router: Router;

  constructor(private readonly engagementService: IEngagementService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/engagements
     * @desc   Create engagement from plan item
     * @access Private - audit:write
     */
    this.router.post('/', requirePermission('engagement:create'), validate(CreateEngagementFromPlanRequestSchema), this._createFromPlanItem.bind(this));

    /**
     * @route  POST /audit/engagements/adhoc
     * @desc   Create ad-hoc engagement
     * @access Private - audit:write
     */
    this.router.post('/adhoc', requirePermission('engagement:create'), validate(CreateAdhocEngagementRequestSchema), this._createAdhoc.bind(this));

    /**
     * @route  GET /audit/engagements
     * @desc   List engagements
     * @access Private - audit:read
     */
    this.router.get('/', requirePermission('engagement:read'), validate(EngagementQuerySchema, 'query'), this._listEngagements.bind(this));

    /**
     * @route  GET /audit/engagements/:id
     * @desc   Get engagement
     * @access Private - audit:read
     */
    this.router.get('/:id', requirePermission('engagement:read'), this._getEngagementById.bind(this));

    /**
     * @route  PUT /audit/engagements/:id
     * @desc   Update engagement
     * @access Private - audit:write
     */
    this.router.put('/:id', requirePermission('engagement:update'), validate(UpdateEngagementRequestSchema), this._updateEngagement.bind(this));

    /**
     * @route  PATCH /audit/engagements/:id/status
     * @desc   Update engagement status
     * @access Private - audit:write
     */
    this.router.patch('/:id/status', requirePermission('engagement:update'), validate(UpdateEngagementStatusRequestSchema), this._updateStatus.bind(this));
  }

  private async _createFromPlanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const engagement = await this.engagementService.createFromPlanItem(req.body.planItemId, req.body, req.user!);
      res.status(201).json(buildResponse(engagement, 'Audit engagement created'));
    } catch (err) {
      next(err);
    }
  }

  private async _createAdhoc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const engagement = await this.engagementService.createAdhoc(req.body, req.user!);
      res.status(201).json(buildResponse(engagement, 'Ad-hoc audit engagement created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateEngagement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const engagement = await this.engagementService.updateEngagement(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(engagement, 'Audit engagement updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const engagement = await this.engagementService.updateStatus(req.params.id, req.body.status, req.user!);
      res.status(200).json(buildResponse(engagement, 'Audit engagement status updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _getEngagementById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const engagement = await this.engagementService.getEngagementById(req.params.id, req.user!);
      res.status(200).json(buildResponse(engagement));
    } catch (err) {
      next(err);
    }
  }

  private async _listEngagements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { engagements, meta } = await this.engagementService.listEngagements(req.query as never, req.user!);
      res.status(200).json({ ...buildResponse(engagements), meta });
    } catch (err) {
      next(err);
    }
  }
}
