import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  ManagementResponseRequestSchema,
  RemediationEvidenceRequestSchema,
  VerifyRemediationRequestSchema,
} from '../dto/request/follow-up.request.dto';
import { IFollowUpService } from '../service/interface/follow-up.service.interface';

const upload = multer({ storage: multer.memoryStorage() });

export class FollowUpController {
  public readonly router: Router;

  constructor(private readonly followUpService: IFollowUpService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/findings/:id/followup/response
     * @desc   Submit management response
     * @access Private - audit:write
     */
    this.router.post('/findings/:id/followup/response', requirePermission('followup:respond'), validate(ManagementResponseRequestSchema), this._submitManagementResponse.bind(this));

    /**
     * @route  POST /audit/findings/:id/followup/evidence
     * @desc   Submit remediation evidence
     * @access Private - audit:write
     */
    this.router.post('/findings/:id/followup/evidence', requirePermission('followup:evidence'), validate(RemediationEvidenceRequestSchema), this._submitRemediationEvidence.bind(this));

    /**
     * @route  POST /audit/findings/:id/followup/evidence/upload
     * @desc   Upload and submit remediation evidence
     * @access Private - audit:write
     */
    this.router.post('/findings/:id/followup/evidence/upload', requirePermission('followup:evidence'), upload.single('file'), this._uploadRemediationEvidence.bind(this));

    /**
     * @route  POST /audit/findings/:id/followup/verify
     * @desc   Verify remediation
     * @access Private - audit:write
     */
    this.router.post('/findings/:id/followup/verify', requirePermission('followup:verify'), validate(VerifyRemediationRequestSchema), this._verifyRemediation.bind(this));

    /**
     * @route  GET /audit/findings/:id/followup
     * @desc   Get finding follow-up
     * @access Private - audit:read
     */
    this.router.get('/findings/:id/followup', requirePermission('followup:read'), this._getFollowUp.bind(this));

    /**
     * @route  GET /audit/engagements/:id/followups
     * @desc   List pending follow-ups
     * @access Private - audit:read
     */
    this.router.get('/engagements/:id/followups', requirePermission('followup:read'), this._listPendingFollowUps.bind(this));
  }

  private async _submitManagementResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const followUp = await this.followUpService.submitManagementResponse(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(followUp, 'Management response submitted'));
    } catch (err) {
      next(err);
    }
  }

  private async _submitRemediationEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const followUp = await this.followUpService.submitRemediationEvidence(req.params.id, req.body.evidenceId, req.user!);
      res.status(200).json(buildResponse(followUp, 'Remediation evidence submitted'));
    } catch (err) {
      next(err);
    }
  }

  private async _uploadRemediationEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw AppError.badRequest('File is required');
      }

      const followUp = await this.followUpService.uploadRemediationEvidence(
        req.params.id,
        {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          buffer: req.file.buffer,
        },
        req.user!,
      );
      res.status(201).json(buildResponse(followUp, 'Remediation evidence uploaded'));
    } catch (err) {
      next(err);
    }
  }

  private async _verifyRemediation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const followUp = await this.followUpService.verifyRemediation(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(followUp, 'Remediation verification updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _getFollowUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const followUp = await this.followUpService.getFollowUp(req.params.id, req.user!);
      res.status(200).json(buildResponse(followUp));
    } catch (err) {
      next(err);
    }
  }

  private async _listPendingFollowUps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const followUps = await this.followUpService.listPendingFollowUps(req.params.id, req.user!);
      res.status(200).json(buildResponse(followUps));
    } catch (err) {
      next(err);
    }
  }
}
