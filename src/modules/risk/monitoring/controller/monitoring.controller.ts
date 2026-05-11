import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { HighRiskQuerySchema } from '../dto/request/monitoring.request.dto';
import { IMonitoringService } from '../service/interface/monitoring.service.interface';

export class MonitoringController {
  public readonly router: Router;

  constructor(private readonly monitoringService: IMonitoringService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /risk/monitoring/high-risk
     * @desc   List high-risk register items
     * @access Private - audit:read
     */
    this.router.get('/monitoring/high-risk', requirePermission('risk_monitoring:read'), validate(HighRiskQuerySchema, 'query'), this._getHighRiskItems.bind(this));

    /**
     * @route  GET /risk/monitoring/attention-required
     * @desc   List risks requiring assessment attention
     * @access Private - audit:read
     */
    this.router.get('/monitoring/attention-required', requirePermission('risk_monitoring:read'), this._getRisksRequiringAttention.bind(this));

    /**
     * @route  GET /risk/monitoring/summary
     * @desc   Get organization risk summary
     * @access Private - audit:read
     */
    this.router.get('/monitoring/summary', requirePermission('risk_monitoring:read'), this._getOrganizationRiskSummary.bind(this));

    /**
     * @route  GET /risk/register/:id/trend
     * @desc   Get risk score trend
     * @access Private - audit:read
     */
    this.router.get('/register/:id/trend', requirePermission('risk:read'), this._getRiskScoreTrend.bind(this));
  }

  private async _getHighRiskItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { risks, meta } = await this.monitoringService.getHighRiskItems(req.query as never, req.user!);
      res.status(200).json({ ...buildResponse(risks), meta });
    } catch (err) {
      next(err);
    }
  }

  private async _getRisksRequiringAttention(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const risks = await this.monitoringService.getRisksRequiringAttention(req.user!);
      res.status(200).json(buildResponse(risks));
    } catch (err) {
      next(err);
    }
  }

  private async _getRiskScoreTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trend = await this.monitoringService.getRiskScoreTrend(req.params.id, req.user!);
      res.status(200).json(buildResponse(trend));
    } catch (err) {
      next(err);
    }
  }

  private async _getOrganizationRiskSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await this.monitoringService.getOrganizationRiskSummary(req.user!);
      res.status(200).json(buildResponse(summary));
    } catch (err) {
      next(err);
    }
  }
}
