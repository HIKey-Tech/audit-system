import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  DisputeEvidenceRequestSchema,
  EvidenceQuerySchema,
  UploadEvidenceMetadataSchema,
} from '../dto/request/evidence.request.dto';
import { IEvidenceService } from '../service/interface/evidence.service.interface';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export class EvidenceController {
  public readonly router: Router;

  constructor(private readonly evidenceService: IEvidenceService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/engagements/:id/evidence
     * @desc   Upload audit evidence
     * @access Private - audit:write
     */
    this.router.post('/engagements/:id/evidence', requirePermission('audit:write'), upload.single('file'), validate(UploadEvidenceMetadataSchema), this._uploadEvidence.bind(this));

    /**
     * @route  GET /audit/engagements/:id/evidence
     * @desc   List audit evidence
     * @access Private - audit:read
     */
    this.router.get('/engagements/:id/evidence', requirePermission('audit:read'), validate(EvidenceQuerySchema, 'query'), this._listEvidence.bind(this));

    /**
     * @route  POST /audit/evidence/:id/link/working-paper/:wpId
     * @desc   Link evidence to working paper
     * @access Private - audit:write
     */
    this.router.post('/evidence/:id/link/working-paper/:wpId', requirePermission('audit:write'), this._linkToWorkingPaper.bind(this));

    /**
     * @route  POST /audit/evidence/:id/link/finding/:findingId
     * @desc   Link evidence to finding
     * @access Private - audit:write
     */
    this.router.post('/evidence/:id/link/finding/:findingId', requirePermission('audit:write'), this._linkToFinding.bind(this));

    /**
     * @route  POST /audit/evidence/:id/dispute
     * @desc   Dispute evidence
     * @access Private - audit:admin
     */
    this.router.post('/evidence/:id/dispute', requirePermission('audit:admin'), validate(DisputeEvidenceRequestSchema), this._disputeEvidence.bind(this));
  }

  private async _uploadEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw AppError.badRequest('File is required (multipart field "file")');
      const evidence = await this.evidenceService.uploadEvidence(
        req.params.id,
        {
          workingPaperId: req.body.workingPaperId,
          findingId: req.body.findingId,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          buffer: req.file.buffer,
        },
        req.user!,
      );
      res.status(201).json(buildResponse(evidence, 'Evidence uploaded'));
    } catch (err) {
      next(err);
    }
  }

  private async _linkToWorkingPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const evidence = await this.evidenceService.linkToWorkingPaper(req.params.id, req.params.wpId, req.user!);
      res.status(200).json(buildResponse(evidence, 'Evidence linked to working paper'));
    } catch (err) {
      next(err);
    }
  }

  private async _linkToFinding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const evidence = await this.evidenceService.linkToFinding(req.params.id, req.params.findingId, req.user!);
      res.status(200).json(buildResponse(evidence, 'Evidence linked to finding'));
    } catch (err) {
      next(err);
    }
  }

  private async _disputeEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const evidence = await this.evidenceService.disputeEvidence(req.params.id, req.body.reason, req.user!);
      res.status(200).json(buildResponse(evidence, 'Evidence disputed'));
    } catch (err) {
      next(err);
    }
  }

  private async _listEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const evidence = await this.evidenceService.listEvidence(req.params.id, req.query as never);
      res.status(200).json(buildResponse(evidence));
    } catch (err) {
      next(err);
    }
  }
}
