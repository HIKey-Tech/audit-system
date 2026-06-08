import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { AppError } from '../../../../shared/errors/app.error';
import { IRequestService } from '../service/interface/request.service.interface';
import {
  ApproveRequestSchema,
  CommentRequestSchema,
  CreateRequestSchema,
  RejectRequestSchema,
  RequestInboxQuerySchema,
  RequestListQuerySchema,
  SignRequestSchema,
} from '../dto/request/request.request.dto';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

export class RequestController {
  public readonly router: Router;

  constructor(private readonly requestService: IRequestService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /workflow/requests/candidates
     * @desc   Eligible recipients (active users with request:receive)
     * @access Private - request:create
     */
    this.router.get('/candidates', requirePermission('request:create'), this._getCandidates.bind(this));

    /**
     * @route  GET /workflow/requests/inbox
     * @desc   Requests where the caller is the current recipient
     * @access Private - request:read
     */
    this.router.get('/inbox', requirePermission('request:read'), validate(RequestInboxQuerySchema, 'query'), this._inbox.bind(this));

    /**
     * @route  GET /workflow/requests
     * @desc   List requests the caller initiated or received
     * @access Private - request:read
     */
    this.router.get('/', requirePermission('request:read'), validate(RequestListQuerySchema, 'query'), this._list.bind(this));

    /**
     * @route  POST /workflow/requests
     * @desc   Initiate an ad-hoc request with an ordered recipient chain
     * @access Private - request:create
     */
    this.router.post('/', requirePermission('request:create'), validate(CreateRequestSchema), this._create.bind(this));

    /**
     * @route  POST /workflow/requests/:id/attachments
     * @desc   Attach a file/image (initiator only, before first action)
     * @access Private - request:create
     */
    this.router.post('/:id/attachments', requirePermission('request:create'), upload.single('file'), this._addAttachment.bind(this));

    /**
     * @route  GET /workflow/requests/:id
     * @desc   Request detail (steps, action ledger, attachments)
     * @access Private - request:read
     */
    this.router.get('/:id', requirePermission('request:read'), this._getById.bind(this));

    /**
     * @route  GET /workflow/requests/:id/verify-signatures
     * @desc   Recompute signature hashes and report tamper status
     * @access Private - request:read
     */
    this.router.get('/:id/verify-signatures', requirePermission('request:read'), this._verifySignatures.bind(this));

    /**
     * @route  POST /workflow/requests/:id/approve
     * @access Private - request:act
     */
    this.router.post('/:id/approve', requirePermission('request:act'), validate(ApproveRequestSchema), this._approve.bind(this));

    /**
     * @route  POST /workflow/requests/:id/sign
     * @access Private - request:act
     */
    this.router.post('/:id/sign', requirePermission('request:act'), validate(SignRequestSchema), this._sign.bind(this));

    /**
     * @route  POST /workflow/requests/:id/reject
     * @access Private - request:act
     */
    this.router.post('/:id/reject', requirePermission('request:act'), validate(RejectRequestSchema), this._reject.bind(this));

    /**
     * @route  POST /workflow/requests/:id/comment
     * @access Private - request:act
     */
    this.router.post('/:id/comment', requirePermission('request:act'), validate(CommentRequestSchema), this._comment.bind(this));

    /**
     * @route  POST /workflow/requests/:id/cancel
     * @access Private - request:create (initiator) or request:admin
     */
    this.router.post('/:id/cancel', requirePermission('request:create'), this._cancel.bind(this));
  }

  private async _getCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const candidates = await this.requestService.getCandidates(req.user!);
      res.status(200).json(buildResponse(candidates, 'Eligible recipients retrieved'));
    } catch (err) {
      next(err);
    }
  }

  private async _inbox(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { requests, meta } = await this.requestService.inbox(req.query as never, req.user!);
      res.status(200).json(buildResponse(requests, 'Request inbox retrieved', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { requests, meta } = await this.requestService.list(req.query as never, req.user!);
      res.status(200).json(buildResponse(requests, 'Requests retrieved', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.requestService.createRequest(req.body, req.user!);
      res.status(201).json(buildResponse(request, 'Request created'));
    } catch (err) {
      next(err);
    }
  }

  private async _addAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw AppError.badRequest('File is required (multipart field "file")');
      const attachment = await this.requestService.addAttachment(
        req.params.id,
        {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          buffer: req.file.buffer,
        },
        req.user!,
      );
      res.status(201).json(buildResponse(attachment, 'Attachment added'));
    } catch (err) {
      next(err);
    }
  }

  private async _getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.requestService.getById(req.params.id, req.user!);
      res.status(200).json(buildResponse(request));
    } catch (err) {
      next(err);
    }
  }

  private async _verifySignatures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.requestService.verifySignatures(req.params.id, req.user!);
      res.status(200).json(buildResponse(result, 'Signature verification complete'));
    } catch (err) {
      next(err);
    }
  }

  private async _approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.requestService.approve(req.params.id, req.user!, req.body);
      res.status(200).json(buildResponse(request, 'Request approved'));
    } catch (err) {
      next(err);
    }
  }

  private async _sign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.requestService.sign(req.params.id, req.user!, req.body);
      res.status(200).json(buildResponse(request, 'Request signed'));
    } catch (err) {
      next(err);
    }
  }

  private async _reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.requestService.reject(req.params.id, req.user!, req.body);
      res.status(200).json(buildResponse(request, 'Request rejected'));
    } catch (err) {
      next(err);
    }
  }

  private async _comment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.requestService.comment(req.params.id, req.user!, req.body);
      res.status(200).json(buildResponse(request, 'Comment added'));
    } catch (err) {
      next(err);
    }
  }

  private async _cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await this.requestService.cancel(req.params.id, req.user!);
      res.status(200).json(buildResponse(request, 'Request cancelled'));
    } catch (err) {
      next(err);
    }
  }
}
