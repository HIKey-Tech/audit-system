import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  ExportReportQuerySchema,
  RejectReportRequestSchema,
  UpdateReportRequestSchema,
} from '../dto/request/report.request.dto';
import { IReportService } from '../service/interface/report.service.interface';

export class ReportController {
  public readonly router: Router;

  constructor(private readonly reportService: IReportService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/engagements/:id/report/generate
     * @desc   Generate audit report
     * @access Private - audit:write
     */
    this.router.post('/engagements/:id/report/generate', requirePermission('report:create'), this._generateReport.bind(this));

    /**
     * @route  GET /audit/engagements/:id/report
     * @desc   Get audit report for engagement
     * @access Private - audit:read
     */
    this.router.get('/engagements/:id/report', requirePermission('report:read'), this._getReport.bind(this));

    /**
     * @route  PUT /audit/reports/:id
     * @desc   Update audit report
     * @access Private - audit:write
     */
    this.router.put('/reports/:id', requirePermission('report:update'), validate(UpdateReportRequestSchema), this._updateReport.bind(this));

    /**
     * @route  POST /audit/reports/:id/submit
     * @desc   Submit audit report
     * @access Private - audit:write
     */
    this.router.post('/reports/:id/submit', requirePermission('report:submit'), this._submitReportForApproval.bind(this));

    /**
     * @route  POST /audit/reports/:id/approve
     * @desc   Approve audit report
     * @access Private - audit:admin
     */
    this.router.post('/reports/:id/approve', requirePermission('report:approve'), this._approveReport.bind(this));

    /**
     * @route  POST /audit/reports/:id/reject
     * @desc   Reject audit report
     * @access Private - audit:admin
     */
    this.router.post('/reports/:id/reject', requirePermission('report:reject'), validate(RejectReportRequestSchema), this._rejectReport.bind(this));

    /**
     * @route  POST /audit/reports/:id/issue
     * @desc   Issue audit report
     * @access Private - audit:admin
     */
    this.router.post('/reports/:id/issue', requirePermission('report:issue'), this._issueReport.bind(this));

    /**
     * @route  GET /audit/reports/:id/export
     * @desc   Export audit report
     * @access Private - audit:read
     */
    this.router.get('/reports/:id/export', requirePermission('report:export'), validate(ExportReportQuerySchema, 'query'), this._exportReport.bind(this));
  }

  private async _generateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await this.reportService.generateReport(req.params.id, req.body ?? {}, req.user!);
      res.status(201).json(buildResponse(report, 'Audit report generated'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await this.reportService.updateReport(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(report, 'Audit report updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _submitReportForApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await this.reportService.submitReportForApproval(req.params.id, req.user!);
      res.status(200).json(buildResponse(report, 'Audit report submitted'));
    } catch (err) {
      next(err);
    }
  }

  private async _approveReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await this.reportService.approveReport(req.params.id, req.user!);
      res.status(200).json(buildResponse(report, 'Audit report approved'));
    } catch (err) {
      next(err);
    }
  }

  private async _rejectReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await this.reportService.rejectReport(req.params.id, req.body.reason, req.user!);
      res.status(200).json(buildResponse(report, 'Audit report rejected'));
    } catch (err) {
      next(err);
    }
  }

  private async _issueReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await this.reportService.issueReport(req.params.id, req.user!);
      res.status(200).json(buildResponse(report, 'Audit report issued'));
    } catch (err) {
      next(err);
    }
  }

  private async _getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await this.reportService.getReport(req.params.id);
      res.status(200).json(buildResponse(report));
    } catch (err) {
      next(err);
    }
  }

  private async _exportReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as 'docx' | 'pdf' | undefined) ?? 'pdf';
      const file = await this.reportService.exportReport(req.params.id, format);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
}
