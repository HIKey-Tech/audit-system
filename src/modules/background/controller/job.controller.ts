// src/modules/background/controller/job.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IBackgroundJobService } from '../service/interface/job.service.interface';
import {
  JobIdParamsSchema,
  JobRunHistoryQuerySchema,
} from '../dto/request/job.request.dto';

export class BackgroundJobController {
  public readonly router: Router;

  constructor(private readonly jobService: IBackgroundJobService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // All job routes require authentication
    this.router.use(authenticate);

    /**
     * @route  GET /jobs
     * @desc   List all registered background jobs with current status and last run
     * @access Private — job:read
     */
    this.router.get(
      '/',
      requirePermission('job:read'),
      this._listJobs.bind(this),
    );

    /**
     * @route  GET /jobs/:id
     * @desc   Get a single background job by ID with its run history
     * @access Private — job:read
     */
    this.router.get(
      '/:id',
      requirePermission('job:read'),
      validate(JobIdParamsSchema, 'params'),
      this._getJobById.bind(this),
    );

    /**
     * @route  GET /jobs/:id/runs
     * @desc   Paginated run history for a specific job
     * @access Private — job:read
     */
    this.router.get(
      '/:id/runs',
      requirePermission('job:read'),
      validate(JobIdParamsSchema, 'params'),
      validate(JobRunHistoryQuerySchema, 'query'),
      this._listRuns.bind(this),
    );

    /**
     * @route  POST /jobs/:id/enable
     * @desc   Enable and immediately start a background job
     * @access Private — job:admin
     */
    this.router.post(
      '/:id/enable',
      requirePermission('job:admin'),
      validate(JobIdParamsSchema, 'params'),
      this._enableJob.bind(this),
    );

    /**
     * @route  POST /jobs/:id/disable
     * @desc   Disable and immediately stop a background job
     * @access Private — job:admin
     */
    this.router.post(
      '/:id/disable',
      requirePermission('job:admin'),
      validate(JobIdParamsSchema, 'params'),
      this._disableJob.bind(this),
    );
  }

  private async _listJobs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobs = await this.jobService.listJobs();
      res.status(200).json(buildResponse(jobs));
    } catch (err) {
      next(err);
    }
  }

  private async _getJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.jobService.getJobById(req.params.id);
      res.status(200).json(buildResponse(job));
    } catch (err) {
      next(err);
    }
  }

  private async _listRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runs, meta } = await this.jobService.listRuns(
        req.params.id,
        req.query as never,
      );
      res.status(200).json({ ...buildResponse(runs), meta });
    } catch (err) {
      next(err);
    }
  }

  private async _enableJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.jobService.enableJob(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(job, 'Job enabled'));
    } catch (err) {
      next(err);
    }
  }

  private async _disableJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.jobService.disableJob(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(job, 'Job disabled'));
    } catch (err) {
      next(err);
    }
  }
}
