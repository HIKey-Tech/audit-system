import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { InsightFeedbackSchema } from '../dto/request/predictive.request.dto';
import { PredictiveService } from '../service/implementation/predictive.service';

export class PredictiveController {
  public readonly router: Router;

  constructor(private readonly predictiveService: PredictiveService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route GET /predictive/overview
     * @desc Explainable live-data early warnings and role-scoped next actions
     * @access Private — predictive:read
     */
    this.router.get(
      '/overview',
      requirePermission('predictive:read'),
      this._getOverview.bind(this),
    );

    /**
     * @route POST /predictive/insights/:id/feedback
     * @desc Record whether an insight was useful; creates live model-feedback data
     * @access Private — predictive:read and source-record visibility
     */
    this.router.post(
      '/insights/:id/feedback',
      requirePermission('predictive:read'),
      validate(InsightFeedbackSchema),
      this._recordFeedback.bind(this),
    );
  }

  private async _getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await this.predictiveService.getOverview(req.user!);
      res.status(200).json(buildResponse(overview));
    } catch (err) {
      next(err);
    }
  }

  private async _recordFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.predictiveService.recordFeedback(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(undefined, 'Insight feedback recorded'));
    } catch (err) {
      next(err);
    }
  }
}
