import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAnyPermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  ExportPeriodicReportQuerySchema,
  PeriodicReportQuerySchema,
  type ExportPeriodicReportQueryDto,
  type PeriodicReportQueryDto,
} from '../dto/periodic-report.dto';
import { PeriodicReportService } from '../service/periodic-report.service';

export class PeriodicReportController {
  public readonly router: Router;

  constructor(private readonly periodicReportService: PeriodicReportService = new PeriodicReportService()) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /audit/periodic-reports
     * @desc   Get periodic audit activity report (monthly, quarterly, yearly, or custom)
     * @access Private - report:read | engagement:read | dashboard:read
     */
    this.router.get(
      '/periodic-reports',
      requireAnyPermission('report:read', 'engagement:read', 'dashboard:read'),
      validate(PeriodicReportQuerySchema, 'query'),
      this._getPeriodicReport.bind(this),
    );

    /**
     * @route  GET /audit/periodic-reports/export
     * @desc   Export periodic audit activity report as Word (.docx) or PDF (.pdf)
     * @access Private - report:read | engagement:read | dashboard:read
     */
    this.router.get(
      '/periodic-reports/export',
      requireAnyPermission('report:read', 'engagement:read', 'dashboard:read'),
      validate(ExportPeriodicReportQuerySchema, 'query'),
      this._exportPeriodicReport.bind(this),
    );
  }

  private async _getPeriodicReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as PeriodicReportQueryDto;
      const report = await this.periodicReportService.getPeriodicReport(query, req.user!);
      res.status(200).json(buildResponse(report, 'Periodic audit activity report retrieved'));
    } catch (err) {
      next(err);
    }
  }

  private async _exportPeriodicReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ExportPeriodicReportQueryDto;
      const format = query.format === 'docx' ? 'docx' : 'pdf';
      const file = await this.periodicReportService.exportPeriodicReport(query, format, req.user!);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
}
