import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  CreateEvidenceRequestSchema,
  ReturnEvidenceRequestSchema,
} from '../dto/request/evidence-request.request.dto';
import { IEvidenceRequestService } from '../service/interface/evidence-request.service.interface';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export class EvidenceRequestController {
  public readonly router: Router;

  constructor(private readonly evidenceRequestService: IEvidenceRequestService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/engagements/:id/evidence-requests
     * @desc   Ask the auditee for specific documents (PBC item)
     * @access Private - evidence:request
     */
    this.router.post('/engagements/:id/evidence-requests', requirePermission('evidence:request'), validate(CreateEvidenceRequestSchema), this._create.bind(this));

    /**
     * @route  GET /audit/engagements/:id/evidence-requests
     * @desc   List evidence requests on an engagement (auditee sees only their own)
     * @access Private - authenticated; service scopes visibility
     */
    this.router.get('/engagements/:id/evidence-requests', this._listForEngagement.bind(this));

    /**
     * @route  GET /audit/evidence-requests/mine
     * @desc   Outstanding evidence requests assigned to the caller
     * @access Private - authenticated
     */
    this.router.get('/evidence-requests/mine', this._listMine.bind(this));

    /**
     * @route  POST /audit/evidence-requests/:id/respond
     * @desc   Upload a document against a request (assigned user only)
     * @access Private - authenticated; service enforces assignment
     */
    this.router.post('/evidence-requests/:id/respond', upload.single('file'), this._respond.bind(this));

    /**
     * @route  POST /audit/evidence-requests/:id/accept
     * @desc   Accept a submission and mark the request fulfilled
     * @access Private - evidence:request
     */
    this.router.post('/evidence-requests/:id/accept', requirePermission('evidence:request'), this._accept.bind(this));

    /**
     * @route  POST /audit/evidence-requests/:id/return
     * @desc   Return a submission to the auditee with a reason
     * @access Private - evidence:request
     */
    this.router.post('/evidence-requests/:id/return', requirePermission('evidence:request'), validate(ReturnEvidenceRequestSchema), this._return.bind(this));

    /**
     * @route  DELETE /audit/evidence-requests/:id
     * @desc   Cancel (soft-delete) an unfulfilled request
     * @access Private - evidence:request
     */
    this.router.delete('/evidence-requests/:id', requirePermission('evidence:request'), this._cancel.bind(this));
  }

  private async _create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.evidenceRequestService.createRequest(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(request, 'Evidence request created'));
    } catch (err) {
      next(err);
    }
  }

  private async _listForEngagement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requests = await this.evidenceRequestService.listForEngagement(req.params.id, req.user!);
      res.status(200).json(buildResponse(requests));
    } catch (err) {
      next(err);
    }
  }

  private async _listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requests = await this.evidenceRequestService.listMine(req.user!);
      res.status(200).json(buildResponse(requests));
    } catch (err) {
      next(err);
    }
  }

  private async _respond(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw AppError.badRequest('File is required (multipart field "file")');
      const request = await this.evidenceRequestService.respond(
        req.params.id,
        {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          buffer: req.file.buffer,
        },
        req.user!,
      );
      res.status(200).json(buildResponse(request, 'Evidence submitted'));
    } catch (err) {
      next(err);
    }
  }

  private async _accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.evidenceRequestService.accept(req.params.id, req.user!);
      res.status(200).json(buildResponse(request, 'Evidence request fulfilled'));
    } catch (err) {
      next(err);
    }
  }

  private async _return(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.evidenceRequestService.returnRequest(req.params.id, req.body.reason, req.user!);
      res.status(200).json(buildResponse(request, 'Evidence request returned'));
    } catch (err) {
      next(err);
    }
  }

  private async _cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.evidenceRequestService.cancelRequest(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Evidence request cancelled'));
    } catch (err) {
      next(err);
    }
  }
}
