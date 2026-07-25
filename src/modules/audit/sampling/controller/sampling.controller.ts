import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { RunSamplingRequestSchema, SampleSizeRequestSchema } from '../dto/request/sampling.request.dto';
import { ISamplingService } from '../service/interface/sampling.service.interface';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export class SamplingController {
  public readonly router: Router;

  constructor(private readonly samplingService: ISamplingService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/engagements/:id/sampling
     * @desc   Draw a reproducible audit sample from an uploaded population CSV;
     *         stores population + sample as engagement evidence
     * @access Private - evidence:upload (the run creates evidence records)
     */
    this.router.post(
      '/engagements/:id/sampling',
      requirePermission('evidence:upload'),
      upload.single('file'),
      validate(RunSamplingRequestSchema),
      this._runSampling.bind(this),
    );

    /**
     * @route  POST /audit/sampling/sample-size
     * @desc   Derive an attribute sample size from confidence + tolerable/expected rate
     * @access Private - evidence:upload (planning a test the same auditors run)
     */
    this.router.post(
      '/sampling/sample-size',
      requirePermission('evidence:upload'),
      validate(SampleSizeRequestSchema),
      this._calculateSampleSize.bind(this),
    );
  }

  private async _calculateSampleSize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = this.samplingService.calculateSampleSize(req.body);
      res.status(200).json(buildResponse(result, 'Sample size calculated'));
    } catch (err) {
      next(err);
    }
  }

  private async _runSampling(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw AppError.badRequest('Population file is required (multipart field "file")');
      const isCsv =
        /\.csv$/i.test(req.file.originalname) ||
        ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(req.file.mimetype);
      if (!isCsv) throw AppError.badRequest('Population file must be a CSV');

      const result = await this.samplingService.runSampling(
        req.params.id,
        {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          buffer: req.file.buffer,
        },
        req.body,
        req.user!,
      );
      res.status(201).json(buildResponse(result, 'Sample drawn'));
    } catch (err) {
      next(err);
    }
  }
}
