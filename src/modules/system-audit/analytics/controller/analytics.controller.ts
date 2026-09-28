import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { isSupportedExtract } from '../../utility/extract-parser.utility';
import {
  CompleteReviewSchema,
  DispositionExceptionsSchema,
  ExceptionExportQueryDto,
  ExceptionExportQuerySchema,
  ExceptionListQueryDto,
  ExceptionListQuerySchema,
  PreviewExtractSchema,
  RaiseFindingSchema,
  RunListQueryDto,
  RunListQuerySchema,
  RunLiveAnalysisSchema,
  RunUploadAnalysisSchema,
} from '../dto/request/analytics.request.dto';
import { ExtractFile, ISystemAuditAnalyticsService } from '../service/interface/analytics.service.interface';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const extractFrom = (req: Request): ExtractFile => {
  if (!req.file) throw AppError.badRequest('Attach the system export (multipart field "file")');
  if (!isSupportedExtract(req.file.originalname)) {
    throw AppError.badRequest('Upload a CSV, TSV, or Excel (.xlsx/.xls) export');
  }
  return {
    originalName: req.file.originalname,
    mimeType: req.file.mimetype || 'application/octet-stream',
    fileSize: req.file.size,
    buffer: req.file.buffer,
  };
};

export class SystemAuditAnalyticsController {
  public readonly router: Router;

  constructor(private readonly analyticsService: ISystemAuditAnalyticsService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /system-audit/analytics/types
     * @desc   Catalogue of analyses: fields, rules, default parameters, live sources
     * @access Private - sysaudit:read
     */
    this.router.get('/types', requirePermission('sysaudit:read'), this._listTypes.bind(this));

    /**
     * @route  POST /system-audit/analytics/preview
     * @desc   Read an export's headers and suggest the column mapping (nothing is stored)
     * @access Private - sysaudit:run
     */
    this.router.post(
      '/preview',
      requirePermission('sysaudit:run'),
      upload.single('file'),
      validate(PreviewExtractSchema),
      this._preview.bind(this),
    );

    /**
     * @route  POST /system-audit/analytics/runs
     * @desc   Analyse an uploaded system export; the file is kept as hashed evidence
     * @access Private - sysaudit:run
     */
    this.router.post(
      '/runs',
      requirePermission('sysaudit:run'),
      upload.single('file'),
      validate(RunUploadAnalysisSchema),
      this._runUpload.bind(this),
    );

    /**
     * @route  POST /system-audit/analytics/runs/live
     * @desc   Analyse live read-only data (IAMS users/security events, Entra ID, IMOC)
     * @access Private - sysaudit:run
     */
    this.router.post(
      '/runs/live',
      requirePermission('sysaudit:run'),
      validate(RunLiveAnalysisSchema),
      this._runLive.bind(this),
    );

    /**
     * @route  GET /system-audit/analytics/runs
     * @desc   List analysis runs visible to the caller
     * @access Private - sysaudit:read
     */
    this.router.get('/runs', requirePermission('sysaudit:read'), validate(RunListQuerySchema, 'query'), this._listRuns.bind(this));

    /**
     * @route  POST /system-audit/analytics/exceptions/disposition
     * @desc   Disposition one or more exceptions (confirmed / false positive / explained / reopen)
     * @access Private - sysaudit:review
     */
    this.router.post(
      '/exceptions/disposition',
      requirePermission('sysaudit:review'),
      validate(DispositionExceptionsSchema),
      this._disposition.bind(this),
    );

    /**
     * @route  GET /system-audit/analytics/runs/:id
     * @desc   Run detail — summary, rule and disposition counts, access-review progress
     * @access Private - sysaudit:read
     */
    this.router.get('/runs/:id', requirePermission('sysaudit:read'), this._getRun.bind(this));

    /**
     * @route  GET /system-audit/analytics/runs/:id/exceptions
     * @desc   Exceptions of a run, most severe first
     * @access Private - sysaudit:read
     */
    this.router.get(
      '/runs/:id/exceptions',
      requirePermission('sysaudit:read'),
      validate(ExceptionListQuerySchema, 'query'),
      this._listExceptions.bind(this),
    );

    /**
     * @route  GET /system-audit/analytics/runs/:id/exceptions/export
     * @desc   Export a run's exceptions as CSV or Excel
     * @access Private - sysaudit:read
     */
    this.router.get(
      '/runs/:id/exceptions/export',
      requirePermission('sysaudit:read'),
      validate(ExceptionExportQuerySchema, 'query'),
      this._exportExceptions.bind(this),
    );

    /**
     * @route  GET /system-audit/analytics/runs/:id/extract
     * @desc   Download the original extract the run analysed
     * @access Private - sysaudit:read
     */
    this.router.get('/runs/:id/extract', requirePermission('sysaudit:read'), this._downloadExtract.bind(this));

    /**
     * @route  POST /system-audit/analytics/runs/:id/findings
     * @desc   Raise an audit finding from selected exceptions
     * @access Private - sysaudit:review + finding:create
     */
    this.router.post(
      '/runs/:id/findings',
      requirePermission('sysaudit:review', 'finding:create'),
      validate(RaiseFindingSchema),
      this._raiseFinding.bind(this),
    );

    /**
     * @route  POST /system-audit/analytics/runs/:id/baseline
     * @desc   Approve a configuration review as the system's baseline
     * @access Private - sysaudit:admin
     */
    this.router.post('/runs/:id/baseline', requirePermission('sysaudit:admin'), this._markBaseline.bind(this));

    /**
     * @route  POST /system-audit/analytics/runs/:id/complete-review
     * @desc   Sign off a run once every exception (and account) has been dispositioned
     * @access Private - sysaudit:review
     */
    this.router.post(
      '/runs/:id/complete-review',
      requirePermission('sysaudit:review'),
      validate(CompleteReviewSchema),
      this._completeReview.bind(this),
    );
  }

  private _listTypes(_req: Request, res: Response, next: NextFunction): void {
    try {
      res.status(200).json(buildResponse(this.analyticsService.listAnalysisTypes()));
    } catch (err) {
      next(err);
    }
  }

  private _preview(req: Request, res: Response, next: NextFunction): void {
    try {
      const preview = this.analyticsService.previewExtract(req.body, extractFrom(req));
      res.status(200).json(buildResponse(preview, 'Extract read'));
    } catch (err) {
      next(err);
    }
  }

  private async _runUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await this.analyticsService.runUploadAnalysis(req.body, extractFrom(req), req.user!);
      res.status(201).json(buildResponse(run, 'Analysis completed'));
    } catch (err) {
      next(err);
    }
  }

  private async _runLive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await this.analyticsService.runLiveAnalysis(req.body, req.user!);
      res.status(201).json(buildResponse(run, 'Analysis completed'));
    } catch (err) {
      next(err);
    }
  }

  private async _listRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runs, meta } = await this.analyticsService.listRuns(req.query as unknown as RunListQueryDto, req.user!);
      res.status(200).json(buildResponse(runs, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _getRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await this.analyticsService.getRun(req.params.id, req.user!);
      res.status(200).json(buildResponse(run));
    } catch (err) {
      next(err);
    }
  }

  private async _listExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { exceptions, meta } = await this.analyticsService.listExceptions(
        req.params.id,
        req.query as unknown as ExceptionListQueryDto,
        req.user!,
      );
      res.status(200).json(buildResponse(exceptions, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _exportExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { format } = req.query as unknown as ExceptionExportQueryDto;
      const file = await this.analyticsService.exportExceptions(req.params.id, format, req.user!);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }

  private async _downloadExtract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await this.analyticsService.getExtractFile(req.params.id, req.user!);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }

  private async _disposition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.analyticsService.dispositionExceptions(req.body, req.user!);
      res.status(200).json(buildResponse(result, 'Exceptions updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _raiseFinding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.analyticsService.raiseFinding(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(result, 'Finding raised'));
    } catch (err) {
      next(err);
    }
  }

  private async _markBaseline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await this.analyticsService.markBaseline(req.params.id, req.user!);
      res.status(200).json(buildResponse(run, 'Baseline approved'));
    } catch (err) {
      next(err);
    }
  }

  private async _completeReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await this.analyticsService.completeReview(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(run, 'Review completed'));
    } catch (err) {
      next(err);
    }
  }
}
