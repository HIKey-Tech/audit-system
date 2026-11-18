import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { AppError } from '../../../shared/errors/app.error';
import {
  CreateWorkspaceDocumentRequestSchema,
  UpdateWorkspaceDocumentRequestSchema,
  WorkspaceDocumentQuerySchema,
} from '../dto/request/workspace.request.dto';
import { IWorkspaceService } from '../service/interface/workspace.service.interface';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

export class WorkspaceController {
  public readonly router: Router;

  constructor(private readonly workspaceService: IWorkspaceService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // Every signed-in person has their own documents; ownership is enforced in the service, so no role is needed.
    this.router.use(authenticate);

    /** @route GET /workspace/documents @desc List my documents @access Private (owner) */
    this.router.get('/documents', validate(WorkspaceDocumentQuerySchema, 'query'), this._list.bind(this));

    /** @route POST /workspace/documents/import @desc Convert a Word file to editor HTML @access Private */
    this.router.post('/documents/import', upload.single('file'), this._import.bind(this));

    /** @route POST /workspace/documents @desc Create a document from the GBB template or a blank page @access Private */
    this.router.post('/documents', validate(CreateWorkspaceDocumentRequestSchema), this._create.bind(this));

    /** @route GET /workspace/documents/:id @desc Open one of my documents @access Private (owner) */
    this.router.get('/documents/:id', this._get.bind(this));

    /** @route PUT /workspace/documents/:id @desc Save changes to one of my documents @access Private (owner) */
    this.router.put('/documents/:id', validate(UpdateWorkspaceDocumentRequestSchema), this._update.bind(this));

    /** @route DELETE /workspace/documents/:id @desc Delete one of my documents @access Private (owner) */
    this.router.delete('/documents/:id', this._remove.bind(this));
  }

  private async _list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(buildResponse(await this.workspaceService.list(req.user!.id, req.query as never)));
    } catch (err) {
      next(err);
    }
  }

  private async _get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(buildResponse(await this.workspaceService.get(req.params.id, req.user!.id)));
    } catch (err) {
      next(err);
    }
  }

  private async _create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await this.workspaceService.create(req.body, { id: req.user!.id, displayName: req.user!.displayName });
      res.status(201).json(buildResponse(doc, 'Document created'));
    } catch (err) {
      next(err);
    }
  }

  private async _update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(buildResponse(await this.workspaceService.update(req.params.id, req.body, req.user!.id), 'Saved'));
    } catch (err) {
      next(err);
    }
  }

  private async _remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.workspaceService.remove(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(null, 'Document deleted'));
    } catch (err) {
      next(err);
    }
  }

  private async _import(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw AppError.badRequest('Choose a Word (.docx) file to import.');
      res.status(200).json(buildResponse(await this.workspaceService.importWord(req.file)));
    } catch (err) {
      next(err);
    }
  }
}
