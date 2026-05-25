// src/modules/document/controller/document.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { AppError } from '../../../shared/errors/app.error';
import { IDocumentService } from '../service/interface/document.service.interface';
import {
  UploadDocumentMetadataSchema,
  UploadVersionMetadataSchema,
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  TemplateQuerySchema,
  DocumentListQuerySchema,
} from '../dto/request/document.request.dto';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export class DocumentController {
  public readonly router: Router;

  constructor(private readonly documentService: IDocumentService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // All document routes require authentication
    this.router.use(authenticate);

    // ────────── Templates (must be registered before `/:id`) ──────────

    /**
     * @route  POST /documents/templates
     * @desc   Create a document template
     * @access Private — document:write
     */
    this.router.post(
      '/templates',
      requirePermission('document_template:write'),
      validate(CreateTemplateRequestSchema),
      this._createTemplate.bind(this),
    );

    /**
     * @route  GET /documents/templates
     * @desc   List templates (paginated, filterable)
     * @access Private — document:read
     */
    this.router.get(
      '/templates',
      requirePermission('document_template:read'),
      validate(TemplateQuerySchema, 'query'),
      this._listTemplates.bind(this),
    );

    /**
     * @route  GET /documents/templates/:id
     * @desc   Get a template by ID
     * @access Private — document:read
     */
    this.router.get(
      '/templates/:id',
      requirePermission('document_template:read'),
      this._getTemplateById.bind(this),
    );

    /**
     * @route  PATCH /documents/templates/:id
     * @desc   Update a template
     * @access Private — document:write
     */
    this.router.patch(
      '/templates/:id',
      requirePermission('document_template:write'),
      validate(UpdateTemplateRequestSchema),
      this._updateTemplate.bind(this),
    );

    /**
     * @route  DELETE /documents/templates/:id
     * @desc   Soft-delete a template
     * @access Private — document:delete
     */
    this.router.delete(
      '/templates/:id',
      requirePermission('document_template:delete'),
      this._deleteTemplate.bind(this),
    );

    // ────────── Document listing by entity ──────────

    /**
     * @route  GET /documents/by-entity/:entityType/:entityId
     * @desc   List documents attached to an entity
     * @access Private — document:read
     */
    this.router.get(
      '/by-entity/:entityType/:entityId',
      requirePermission('document:read'),
      this._listByEntity.bind(this),
    );

    // ────────── File serving (target of LocalStorageClient.getUrl) ──────────

    /**
     * @route  GET /documents/serve/:storedName
     * @desc   Stream the raw file bytes for a document or historical version.
     *         `storedName` is the storage key returned by the storage adapter
     *         (see LocalStorageClient.getUrl). Resolved against Document and
     *         Document_Version storage_path columns.
     * @access Private — document:read
     */
    this.router.get(
      '/serve/:storedName',
      requirePermission('document:read'),
      this._serve.bind(this),
    );

    // ────────── Document CRUD ──────────

    /**
     * @route  GET /documents
     * @desc   List documents (paginated, optional entityType + search filters)
     * @access Private — document:read
     */
    this.router.get(
      '/',
      requirePermission('document:read'),
      validate(DocumentListQuerySchema, 'query'),
      this._list.bind(this),
    );

    /**
     * @route  POST /documents
     * @desc   Upload a new document (multipart/form-data, field "file")
     * @access Private — document:write
     */
    this.router.post(
      '/',
      requirePermission('document:write'),
      upload.single('file'),
      validate(UploadDocumentMetadataSchema),
      this._upload.bind(this),
    );

    /**
     * @route  GET /documents/:id
     * @desc   Get document metadata + download URL
     * @access Private — document:read
     */
    this.router.get(
      '/:id',
      requirePermission('document:read'),
      this._getById.bind(this),
    );

    /**
     * @route  GET /documents/:id/download
     * @desc   Get a download URL for a document
     * @access Private — document:read
     */
    this.router.get(
      '/:id/download',
      requirePermission('document:read'),
      this._getDownloadUrl.bind(this),
    );

    /**
     * @route  GET /documents/:id/file
     * @desc   Stream the raw file bytes for a document, regardless of
     *         storage provider. Lets the browser download from a same-origin
     *         URL so cross-origin S3/Azure objects don't require bucket CORS.
     * @access Private — document:read
     */
    this.router.get(
      '/:id/file',
      requirePermission('document:read'),
      this._getFileById.bind(this),
    );

    /**
     * @route  DELETE /documents/:id
     * @desc   Soft-delete a document
     * @access Private — document:delete
     */
    this.router.delete(
      '/:id',
      requirePermission('document:delete'),
      this._delete.bind(this),
    );

    // ────────── Versioning ──────────

    /**
     * @route  POST /documents/:id/versions
     * @desc   Upload a new version of an existing document
     * @access Private — document:write
     */
    this.router.post(
      '/:id/versions',
      requirePermission('document:write'),
      upload.single('file'),
      validate(UploadVersionMetadataSchema),
      this._uploadNewVersion.bind(this),
    );

    /**
     * @route  GET /documents/:id/versions
     * @desc   List all versions of a document (current + history)
     * @access Private — document:read
     */
    this.router.get(
      '/:id/versions',
      requirePermission('document:read'),
      this._listVersions.bind(this),
    );

    /**
     * @route  GET /documents/:id/versions/:version
     * @desc   Get a specific version of a document
     * @access Private — document:read
     */
    this.router.get(
      '/:id/versions/:version',
      requirePermission('document:read'),
      this._getVersion.bind(this),
    );

    /**
     * @route  GET /documents/:id/versions/:version/download
     * @desc   Get download URL for a specific version
     * @access Private — document:read
     */
    this.router.get(
      '/:id/versions/:version/download',
      requirePermission('document:read'),
      this._getVersionDownloadUrl.bind(this),
    );
  }

  // ──────────────────────────────────────────────────────────
  // Document handlers
  // ──────────────────────────────────────────────────────────

  private async _upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw AppError.badRequest('File is required (multipart field "file")');
      }

      const document = await this.documentService.upload({
        uploadedById: req.user!.id,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        buffer: req.file.buffer,
        module: req.body.module,
        entityType: req.body.entityType,
        entityId: req.body.entityId,
      });
      res.status(201).json(buildResponse(document, 'Document uploaded'));
    } catch (err) {
      next(err);
    }
  }

  private async _getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const document = await this.documentService.getById(req.params.id);
      res.status(200).json(buildResponse(document));
    } catch (err) {
      next(err);
    }
  }

  private async _getDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const downloadUrl = await this.documentService.getDownloadUrl(req.params.id);
      res.status(200).json(buildResponse({ downloadUrl }));
    } catch (err) {
      next(err);
    }
  }

  private async _delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.documentService.delete(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(null, 'Document deleted'));
    } catch (err) {
      next(err);
    }
  }

  private async _listByEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documents = await this.documentService.listByEntity(
        req.params.entityType,
        req.params.entityId,
      );
      res.status(200).json(buildResponse(documents));
    } catch (err) {
      next(err);
    }
  }

  private async _list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documents, meta } = await this.documentService.list(req.query as never);
      res.status(200).json({ ...buildResponse(documents), meta });
    } catch (err) {
      next(err);
    }
  }

  private async _serve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await this.documentService.serveFile(req.params.storedName);
      this._sendFile(res, file);
    } catch (err) {
      next(err);
    }
  }

  private async _getFileById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await this.documentService.getFileById(req.params.id);
      this._sendFile(res, file);
    } catch (err) {
      next(err);
    }
  }

  private _sendFile(
    res: Response,
    file: { buffer: Buffer; mimeType: string; originalName: string; fileSize: number },
  ): void {
    // RFC 5987 encoding keeps non-ASCII filenames intact for browsers.
    const encodedName = encodeURIComponent(file.originalName);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.fileSize);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    );
    res.status(200).send(file.buffer);
  }

  // ──────────────────────────────────────────────────────────
  // Version handlers
  // ──────────────────────────────────────────────────────────

  private async _uploadNewVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw AppError.badRequest('File is required (multipart field "file")');
      }

      const version = await this.documentService.uploadNewVersion(req.params.id, {
        uploadedById: req.user!.id,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        buffer: req.file.buffer,
        changeNote: req.body.changeNote,
      });
      res.status(201).json(buildResponse(version, 'New document version uploaded'));
    } catch (err) {
      next(err);
    }
  }

  private async _listVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versions = await this.documentService.listVersions(req.params.id);
      res.status(200).json(buildResponse(versions));
    } catch (err) {
      next(err);
    }
  }

  private async _getVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versionNumber = Number(req.params.version);
      if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
        throw AppError.badRequest('Version must be a positive integer');
      }
      const version = await this.documentService.getVersion(req.params.id, versionNumber);
      res.status(200).json(buildResponse(version));
    } catch (err) {
      next(err);
    }
  }

  private async _getVersionDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versionNumber = Number(req.params.version);
      if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
        throw AppError.badRequest('Version must be a positive integer');
      }
      const downloadUrl = await this.documentService.getVersionDownloadUrl(
        req.params.id,
        versionNumber,
      );
      res.status(200).json(buildResponse({ downloadUrl }));
    } catch (err) {
      next(err);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Template handlers
  // ──────────────────────────────────────────────────────────

  private async _createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await this.documentService.createTemplate(req.body, req.user!.id);
      res.status(201).json(buildResponse(template, 'Template created'));
    } catch (err) {
      next(err);
    }
  }

  private async _listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { templates, meta } = await this.documentService.listTemplates(req.query as never);
      res.status(200).json({ ...buildResponse(templates), meta });
    } catch (err) {
      next(err);
    }
  }

  private async _getTemplateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await this.documentService.getTemplateById(req.params.id);
      res.status(200).json(buildResponse(template));
    } catch (err) {
      next(err);
    }
  }

  private async _updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await this.documentService.updateTemplate(
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.status(200).json(buildResponse(template, 'Template updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.documentService.deleteTemplate(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(null, 'Template deleted'));
    } catch (err) {
      next(err);
    }
  }
}
