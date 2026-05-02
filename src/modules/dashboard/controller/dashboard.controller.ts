import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { DashboardService } from '../service/implementation/dashboard.service';
import {
  ActivityQueryDto,
  ActivityQuerySchema,
} from '../dto/request/dashboard.request.dto';

export class DashboardController {
  public readonly router: Router;

  constructor(private readonly dashboardService: DashboardService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // All dashboard routes require authentication.
    this.router.use(authenticate);

    /**
     * @route  GET /dashboard/summary
     * @desc   Audit programme summary (engagements + plans, role-aware)
     * @access Private — audit:read
     */
    this.router.get(
      '/summary',
      requirePermission('audit:read'),
      this._getAuditSummary.bind(this),
    );

    /**
     * @route  GET /dashboard/findings
     * @desc   Findings summary (severity / status / resolution metrics)
     * @access Private — finding:read
     */
    this.router.get(
      '/findings',
      requirePermission('finding:read'),
      this._getFindingsSummary.bind(this),
    );

    /**
     * @route  GET /dashboard/risks
     * @desc   Risk register overview (band / status / top five / stale count)
     * @access Private — audit:read
     */
    this.router.get(
      '/risks',
      requirePermission('audit:read'),
      this._getRiskOverview.bind(this),
    );

    /**
     * @route  GET /dashboard/activity
     * @desc   Recent audit-trail activity across audit, workflow, risk, document, user
     * @access Private — audit:read
     */
    this.router.get(
      '/activity',
      requirePermission('audit:read'),
      validate(ActivityQuerySchema, 'query'),
      this._getRecentActivity.bind(this),
    );

    /**
     * @route  GET /dashboard/escalations
     * @desc   Active escalations overview (level / recent list)
     * @access Private — audit:read
     */
    this.router.get(
      '/escalations',
      requirePermission('audit:read'),
      this._getEscalationOverview.bind(this),
    );

    /**
     * @route  GET /dashboard/my-work
     * @desc   Personal work bundle for the current user
     * @access Private — audit:read
     */
    this.router.get(
      '/my-work',
      requirePermission('audit:read'),
      this._getMyWork.bind(this),
    );

    /**
     * @route  GET /dashboard/approval-inbox
     * @desc   Personal approval inbox summary for the current user
     * @access Private — audit:read
     */
    this.router.get(
      '/approval-inbox',
      requirePermission('audit:read'),
      this._getApprovalInboxSummary.bind(this),
    );
  }

  private async _getAuditSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const summary = await this.dashboardService.getAuditSummary(req.user!);
      res.status(200).json(buildResponse(summary));
    } catch (err) {
      next(err);
    }
  }

  private async _getFindingsSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const summary = await this.dashboardService.getFindingsSummary(req.user!);
      res.status(200).json(buildResponse(summary));
    } catch (err) {
      next(err);
    }
  }

  private async _getRiskOverview(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const overview = await this.dashboardService.getRiskOverview(req.user!);
      res.status(200).json(buildResponse(overview));
    } catch (err) {
      next(err);
    }
  }

  private async _getRecentActivity(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { limit } = req.query as unknown as ActivityQueryDto;
      const activity = await this.dashboardService.getRecentActivity(
        req.user!,
        limit,
      );
      res.status(200).json(buildResponse(activity));
    } catch (err) {
      next(err);
    }
  }

  private async _getEscalationOverview(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const overview = await this.dashboardService.getEscalationOverview(req.user!);
      res.status(200).json(buildResponse(overview));
    } catch (err) {
      next(err);
    }
  }

  private async _getMyWork(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const work = await this.dashboardService.getMyWork(req.user!.id);
      res.status(200).json(buildResponse(work));
    } catch (err) {
      next(err);
    }
  }

  private async _getApprovalInboxSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const summary = await this.dashboardService.getApprovalInboxSummary(req.user!.id);
      res.status(200).json(buildResponse(summary));
    } catch (err) {
      next(err);
    }
  }
}
