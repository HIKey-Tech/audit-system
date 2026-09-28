import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IAuditLogService, ISystemLogService } from '../service/interface/audit-log.service.interface';
import {
  AuditLogExportQueryDto,
  AuditLogExportQuerySchema,
  AuditLogIdParamsSchema,
  AuditLogListQueryDto,
  AuditLogListQuerySchema,
  AuditLogSummaryQueryDto,
  AuditLogSummaryQuerySchema,
  SecuritySummaryQueryDto,
  SecuritySummaryQuerySchema,
  SystemLogListQueryDto,
  SystemLogListQuerySchema,
} from '../dto/request/logging.request.dto';

export class LoggingController {
  public readonly router: Router;

  constructor(
    private readonly auditLogService: IAuditLogService,
    private readonly systemLogService: ISystemLogService,
  ) {
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
     * @route  GET /logs/security/summary
     * @desc   Security event monitoring — sign-ins, failures, denials, token reuse over a window
     * @access Private - log:read
     */
    this.router.get(
      '/security/summary',
      requirePermission('log:read'),
      validate(SecuritySummaryQuerySchema, 'query'),
      this._getSecuritySummary.bind(this),
    );

    /**
     * @route  GET /logs/system
     * @desc   List persisted application exceptions (system exceptions)
     * @access Private - log:read
     */
    this.router.get(
      '/system',
      requirePermission('log:read'),
      validate(SystemLogListQuerySchema, 'query'),
      this._listSystemLogs.bind(this),
    );

    /**
     * @route  GET /logs/system/:id
     * @desc   Get one system exception, including its stack trace
     * @access Private - log:read
     */
    this.router.get(
      '/system/:id',
      requirePermission('log:read'),
      validate(AuditLogIdParamsSchema, 'params'),
      this._getSystemLogById.bind(this),
    );

    /**
     * @route  GET /logs/export
     * @desc   Export the (filtered) audit trail as CSV or Excel
     * @access Private - log:read + log:export
     */
    this.router.get(
      '/export',
      requirePermission('log:read', 'log:export'),
      validate(AuditLogExportQuerySchema, 'query'),
      this._exportLogs.bind(this),
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
     * @route  GET /logs/verify-chain
     * @desc   Verify the audit-log tamper-evidence chain; reports the first break
     * @access Private - log:read
     * @note   Registered before /:id so the literal path is not captured as an id.
     */
    this.router.get(
      '/verify-chain',
      requirePermission('log:read'),
      this._verifyChain.bind(this),
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

  private async _verifyChain(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.auditLogService.verifyChain();
      const message = result.ok
        ? 'Audit log chain intact'
        : `Audit log chain broken: ${result.reason ?? 'unknown'}`;
      res.status(200).json(buildResponse(result, message));
    } catch (err) {
      next(err);
    }
  }

  private async _getSecuritySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await this.auditLogService.getSecuritySummary(req.query as unknown as SecuritySummaryQueryDto);
      res.status(200).json(buildResponse(summary));
    } catch (err) {
      next(err);
    }
  }

  private async _listSystemLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { logs, meta } = await this.systemLogService.listSystemLogs(req.query as unknown as SystemLogListQueryDto);
      res.status(200).json(buildResponse(logs, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _getSystemLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const log = await this.systemLogService.getSystemLogById(req.params.id);
      res.status(200).json(buildResponse(log));
    } catch (err) {
      next(err);
    }
  }

  private async _exportLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { format, ...query } = req.query as unknown as AuditLogExportQueryDto;
      const file = await this.auditLogService.exportLogs({ ...query, page: 1, pageSize: 1 }, format, req.user!.id);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
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
