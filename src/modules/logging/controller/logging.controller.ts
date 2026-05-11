import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IAuditLogService } from '../service/interface/audit-log.service.interface';
import {
  AuditLogIdParamsSchema,
  AuditLogListQueryDto,
  AuditLogListQuerySchema,
  AuditLogSummaryQueryDto,
  AuditLogSummaryQuerySchema,
} from '../dto/request/logging.request.dto';

export class LoggingController {
  public readonly router: Router;

  constructor(private readonly auditLogService: IAuditLogService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // All logging routes require authentication
    this.router.use(authenticate);

    /**
     * @route  GET /logs/modules
     * @desc   List distinct modules that have audit log entries
     * @access Private - log:read
     */
    this.router.get(
      '/modules',
      requirePermission('log:read'),
      this._getDistinctModules.bind(this),
    );

    /**
     * @route  GET /logs/summary
     * @desc   Get audit log aggregate counts grouped by module and status
     * @access Private - log:admin
     */
    this.router.get(
      '/summary',
      requirePermission('log:summary'),
      validate(AuditLogSummaryQuerySchema, 'query'),
      this._getLogSummary.bind(this),
    );

    /**
     * @route  GET /logs
     * @desc   List audit logs (paginated, filterable, sortable)
     * @access Private - log:read
     */
    this.router.get(
      '/',
      requirePermission('log:read'),
      validate(AuditLogListQuerySchema, 'query'),
      this._listLogs.bind(this),
    );

    /**
     * @route  GET /logs/:id
     * @desc   Get a single audit log entry by ID
     * @access Private - log:read
     */
    this.router.get(
      '/:id',
      requirePermission('log:read'),
      validate(AuditLogIdParamsSchema, 'params'),
      this._getLogById.bind(this),
    );
  }

  private async _listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as AuditLogListQueryDto;
      const { logs, meta } = await this.auditLogService.listLogs(query);
      res.status(200).json(buildResponse(logs, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _getLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const log = await this.auditLogService.getLogById(req.params.id);
      res.status(200).json(buildResponse(log));
    } catch (err) {
      next(err);
    }
  }

  private async _getDistinctModules(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const modules = await this.auditLogService.getDistinctModules();
      res.status(200).json(buildResponse(modules));
    } catch (err) {
      next(err);
    }
  }

  private async _getLogSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as AuditLogSummaryQueryDto;
      const summary = await this.auditLogService.getLogSummary(query);
      res.status(200).json(buildResponse(summary));
    } catch (err) {
      next(err);
    }
  }
}
