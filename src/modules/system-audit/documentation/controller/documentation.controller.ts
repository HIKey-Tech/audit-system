import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { ExtractFile } from '../../analytics/service/interface/analytics.service.interface';
import {
  CreateSystemDocumentSchema,
  SystemDocumentListQueryDto,
  SystemDocumentListQuerySchema,
  UpdateSystemDocumentSchema,
  UploadSystemDocumentVersionSchema,
} from '../dto/request/documentation.request.dto';
import { ISystemDocumentationService } from '../service/interface/documentation.service.interface';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const fileFrom = (req: Request): ExtractFile => {
  if (!req.file) throw AppError.badRequest('Attach the document (multipart field "file")');
  return {
    originalName: req.file.originalname,
    mimeType: req.file.mimetype || 'application/octet-stream',
    fileSize: req.file.size,
    buffer: req.file.buffer,
  };
};

export class SystemDocumentationController {
  public readonly router: Router;

  constructor(private readonly documentationService: ISystemDocumentationService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /system-audit/documentation
     * @desc   Library of policies, diagrams, manuals, plans, and contracts (filter by scope)
     * @access Private - sysdoc:read
     */
    this.router.get('/', requirePermission('sysdoc:read'), validate(SystemDocumentListQuerySchema, 'query'), this._list.bind(this));

    /**
     * @route  GET /system-audit/documentation/summary
     * @desc   Counts by type, overdue reviews, and expiring contracts
     * @access Private - sysdoc:read
     */
    this.router.get('/summary', requirePermission('sysdoc:read'), this._summary.bind(this));

    /**
     * @route  POST /system-audit/documentation
     * @desc   Add a document to the library (multipart: file + metadata)
     * @access Private - sysdoc:manage
     */
    this.router.post(
      '/',
      requirePermission('sysdoc:manage'),
      upload.single('file'),
      validate(CreateSystemDocumentSchema),
      this._create.bind(this),
    );

    /**
     * @route  GET /system-audit/documentation/:id
     * @desc   One library document
     * @access Private - sysdoc:read
     */
    this.router.get('/:id', requirePermission('sysdoc:read'), this._get.bind(this));

    /**
     * @route  PUT /system-audit/documentation/:id
     * @desc   Update document metadata, scope links, review and expiry dates, or archive it
     * @access Private - sysdoc:manage
     */
    this.router.put('/:id', requirePermission('sysdoc:manage'), validate(UpdateSystemDocumentSchema), this._update.bind(this));

    /**
     * @route  DELETE /system-audit/documentation/:id
     * @desc   Remove a document from the library (soft delete)
     * @access Private - sysdoc:manage
     */
    this.router.delete('/:id', requirePermission('sysdoc:manage'), this._remove.bind(this));

    /**
     * @route  POST /system-audit/documentation/:id/versions
     * @desc   Upload a new version; the previous file stays in the version history
     * @access Private - sysdoc:manage
     */
    this.router.post(
      '/:id/versions',
      requirePermission('sysdoc:manage'),
      upload.single('file'),
      validate(UploadSystemDocumentVersionSchema),
      this._uploadVersion.bind(this),
    );

    /**
     * @route  GET /system-audit/documentation/:id/download
     * @desc   Download the current version
     * @access Private - sysdoc:read
     */
    this.router.get('/:id/download', requirePermission('sysdoc:read'), this._download.bind(this));
  }

  private async _list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documents, meta } = await this.documentationService.list(
        req.query as unknown as SystemDocumentListQueryDto,
        req.user!,
      );
      res.status(200).json(buildResponse(documents, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(buildResponse(await this.documentationService.summary()));
    } catch (err) {
      next(err);
    }
  }

  private async _create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await this.documentationService.create(req.body, fileFrom(req), req.user!);
      res.status(201).json(buildResponse(doc, 'Document added to the library'));
    } catch (err) {
      next(err);
    }
  }

  private async _get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(buildResponse(await this.documentationService.get(req.params.id)));
    } catch (err) {
      next(err);
    }
  }

  private async _update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await this.documentationService.update(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(doc, 'Document updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.documentationService.remove(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Document removed'));
    } catch (err) {
      next(err);
    }
  }

  private async _uploadVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await this.documentationService.uploadVersion(req.params.id, req.body, fileFrom(req), req.user!);
      res.status(200).json(buildResponse(doc, 'New version uploaded'));
    } catch (err) {
      next(err);
    }
  }

  private async _download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await this.documentationService.getFile(req.params.id, req.user!);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
}
