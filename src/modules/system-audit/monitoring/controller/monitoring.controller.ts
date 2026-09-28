import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { IContinuousMonitoringService } from '../service/interface/monitoring.service.interface';

export class ContinuousMonitoringController {
  public readonly router: Router;

  constructor(private readonly monitoringService: IContinuousMonitoringService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /system-audit/monitoring/dashboard
     * @desc   Continuous monitoring: check status, open exceptions, trends, security events, emerging risks
     * @access Private - sysaudit:read
     */
    this.router.get('/dashboard', requirePermission('sysaudit:read'), this._getDashboard.bind(this));

    /**
     * @route  POST /system-audit/monitoring/run
     * @desc   Run every enabled, connected monitoring check now
     * @access Private - sysaudit:admin
     */
    this.router.post('/run', requirePermission('sysaudit:admin'), this._runNow.bind(this));
  }

  private async _getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dashboard = await this.monitoringService.getDashboard(req.user!);
      res.status(200).json(buildResponse(dashboard));
    } catch (err) {
      next(err);
    }
  }

  private async _runNow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.monitoringService.runChecksNow(req.user!);
      res.status(200).json(buildResponse(result, 'Monitoring checks completed'));
    } catch (err) {
      next(err);
    }
  }
}
