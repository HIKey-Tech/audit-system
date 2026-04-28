import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  EscalationEntityParamsSchema,
  EscalationPolicyQuerySchema,
  UpsertEscalationPolicyRequestSchema,
} from '../dto/request/escalation.request.dto';
import { IEscalationService } from '../service/interface/escalation.service.interface';

export class EscalationController {
  public readonly router: Router;

  constructor(private readonly escalationService: IEscalationService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /workflow/escalations/entity/:type/:id
     * @desc   Get escalation history for an entity
     * @access Private - audit:read
     */
    this.router.get('/escalations/entity/:type/:id', requirePermission('audit:read'), validate(EscalationEntityParamsSchema, 'params'), this._getEscalationHistory.bind(this));

    /**
     * @route  POST /workflow/escalations/:id/acknowledge
     * @desc   Acknowledge escalation
     * @access Private - audit:write
     */
    this.router.post('/escalations/:id/acknowledge', requirePermission('audit:write'), this._acknowledgeEscalation.bind(this));

    /**
     * @route  GET /workflow/escalation-policy
     * @desc   Get escalation policy
     * @access Private - audit:read
     */
    this.router.get('/escalation-policy', requirePermission('audit:read'), validate(EscalationPolicyQuerySchema, 'query'), this._getEscalationPolicy.bind(this));

    /**
     * @route  POST /workflow/escalation-policy
     * @desc   Create or update escalation policy
     * @access Private - audit:admin
     */
    this.router.post('/escalation-policy', requirePermission('audit:admin'), validate(UpsertEscalationPolicyRequestSchema), this._createOrUpdateEscalationPolicy.bind(this));
  }

  private async _getEscalationHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const escalations = await this.escalationService.getEscalationHistory(req.params.type as never, req.params.id);
      res.status(200).json(buildResponse(escalations));
    } catch (err) {
      next(err);
    }
  }

  private async _acknowledgeEscalation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const escalation = await this.escalationService.acknowledgeEscalation(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(escalation, 'Escalation acknowledged'));
    } catch (err) {
      next(err);
    }
  }

  private async _getEscalationPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policy = await this.escalationService.getEscalationPolicy(req.query.auditType as never);
      res.status(200).json(buildResponse(policy));
    } catch (err) {
      next(err);
    }
  }

  private async _createOrUpdateEscalationPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policy = await this.escalationService.createOrUpdateEscalationPolicy(req.body, req.user!);
      res.status(200).json(buildResponse(policy, 'Escalation policy saved'));
    } catch (err) {
      next(err);
    }
  }
}
