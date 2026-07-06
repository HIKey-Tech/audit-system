import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { AppError } from '../../../../shared/errors/app.error';
import {
  AddWorkingPaperCommentSchema,
  ApproveWorkingPaperRequestSchema,
  CreateWorkingPaperRequestSchema,
  ImportWorkingPaperMetadataSchema,
  RejectWorkingPaperRequestSchema,
  UpdateWorkingPaperRequestSchema,
} from '../dto/request/working-paper.request.dto';
import { IWorkingPaperService } from '../service/interface/working-paper.service.interface';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export class WorkingPaperController {
  public readonly router: Router;

  constructor(private readonly workingPaperService: IWorkingPaperService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/engagements/:id/working-papers
     * @desc   Create working paper
     * @access Private - working_paper:create
     */
    this.router.post('/engagements/:id/working-papers', requirePermission('working_paper:create'), validate(CreateWorkingPaperRequestSchema), this._createWorkingPaper.bind(this));

    /**
     * @route  POST /audit/engagements/:id/working-papers/import-preview
     * @desc   Upload and extract a working paper into a reviewable draft preview
     * @access Private - working_paper:create
     */
    this.router.post(
      '/engagements/:id/working-papers/import-preview',
      requirePermission('working_paper:create'),
      upload.single('file'),
      validate(ImportWorkingPaperMetadataSchema),
      this._previewWorkingPaperImport.bind(this),
    );

    /**
     * @route  GET /audit/engagements/:id/working-papers
     * @desc   List working papers
     * @access Private - working_paper:read
     */
    this.router.get('/engagements/:id/working-papers', requirePermission('working_paper:read'), this._listWorkingPapers.bind(this));

    /**
     * @route  GET /audit/working-papers/:id
     * @desc   Get working paper
     * @access Private - working_paper:read
     */
    this.router.get('/working-papers/:id', requirePermission('working_paper:read'), this._getWorkingPaperById.bind(this));

    /**
     * @route  PUT /audit/working-papers/:id
     * @desc   Update working paper
     * @access Private - working_paper:update
     */
    this.router.put('/working-papers/:id', requirePermission('working_paper:update'), validate(UpdateWorkingPaperRequestSchema), this._updateWorkingPaper.bind(this));

    /**
     * @route  POST /audit/working-papers/:id/submit
     * @desc   Submit working paper
     * @access Private - working_paper:submit
     */
    this.router.post('/working-papers/:id/submit', requirePermission('working_paper:submit'), this._submitWorkingPaper.bind(this));

    /**
     * @route  POST /audit/working-papers/:id/approve
     * @desc   Approve working paper
     * @access Private - working_paper:approve
     */
    this.router.post('/working-papers/:id/approve', requirePermission('working_paper:approve'), validate(ApproveWorkingPaperRequestSchema), this._approveWorkingPaper.bind(this));

    /**
     * @route  POST /audit/working-papers/:id/comments
     * @desc   Add a review comment (reviewer ↔ preparer back-and-forth)
     * @access Private - working_paper:read
     */
    this.router.post('/working-papers/:id/comments', requirePermission('working_paper:read'), validate(AddWorkingPaperCommentSchema), this._addComment.bind(this));

    /**
     * @route  GET /audit/working-papers/:id/comments
     * @desc   List review comments on a working paper
     * @access Private - working_paper:read
     */
    this.router.get('/working-papers/:id/comments', requirePermission('working_paper:read'), this._listComments.bind(this));

    /**
     * @route  POST /audit/working-papers/comments/:commentId/resolve
     * @desc   Mark a review comment as addressed
     * @access Private - working_paper:read (author/preparer/reviewer enforced in service)
     */
    this.router.post('/working-papers/comments/:commentId/resolve', requirePermission('working_paper:read'), this._resolveComment.bind(this));

    /**
     * @route  POST /audit/working-papers/:id/reject
     * @desc   Reject working paper
     * @access Private - working_paper:reject
     */
    this.router.post('/working-papers/:id/reject', requirePermission('working_paper:reject'), validate(RejectWorkingPaperRequestSchema), this._rejectWorkingPaper.bind(this));

    /**
     * @route  GET /audit/working-papers/:id/export?format=docx|pdf
     * @desc   Export an approved working paper as DOCX (default) or PDF
     * @access Private - working_paper:read
     */
    this.router.get('/working-papers/:id/export', requirePermission('working_paper:read'), this._exportWorkingPaper.bind(this));
  }

  private async _createWorkingPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paper = await this.workingPaperService.createWorkingPaper(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(paper, 'Working paper created'));
    } catch (err) {
      next(err);
    }
  }

  private async _previewWorkingPaperImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw AppError.badRequest('File is required (multipart field "file")');
      }

      const preview = await this.workingPaperService.previewWorkingPaperImport(
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
      res.status(200).json(buildResponse(preview, 'Working paper import preview generated'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateWorkingPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paper = await this.workingPaperService.updateWorkingPaper(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(paper, 'Working paper updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _submitWorkingPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paper = await this.workingPaperService.submitWorkingPaper(req.params.id, req.user!);
      res.status(200).json(buildResponse(paper, 'Working paper submitted'));
    } catch (err) {
      next(err);
    }
  }

  private async _approveWorkingPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paper = await this.workingPaperService.approveWorkingPaper(req.params.id, req.user!, req.body.edits);
      res.status(200).json(buildResponse(paper, 'Working paper approved'));
    } catch (err) {
      next(err);
    }
  }

  private async _addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const comment = await this.workingPaperService.addComment(req.params.id, req.body.body, req.user!);
      res.status(201).json(buildResponse(comment, 'Comment added'));
    } catch (err) {
      next(err);
    }
  }

  private async _listComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const comments = await this.workingPaperService.listComments(req.params.id, req.user!);
      res.status(200).json(buildResponse(comments));
    } catch (err) {
      next(err);
    }
  }

  private async _resolveComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const comment = await this.workingPaperService.resolveComment(req.params.commentId, req.user!);
      res.status(200).json(buildResponse(comment, 'Comment resolved'));
    } catch (err) {
      next(err);
    }
  }

  private async _rejectWorkingPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paper = await this.workingPaperService.rejectWorkingPaper(req.params.id, req.body.reason, req.user!);
      res.status(200).json(buildResponse(paper, 'Working paper rejected'));
    } catch (err) {
      next(err);
    }
  }

  private async _getWorkingPaperById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paper = await this.workingPaperService.getWorkingPaperById(req.params.id, req.user!);
      res.status(200).json(buildResponse(paper));
    } catch (err) {
      next(err);
    }
  }

  private async _listWorkingPapers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const papers = await this.workingPaperService.listWorkingPapers(req.params.id, req.user!);
      res.status(200).json(buildResponse(papers));
    } catch (err) {
      next(err);
    }
  }

  private async _exportWorkingPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requested = String(req.query.format ?? 'docx').toLowerCase();
      if (requested !== 'docx' && requested !== 'pdf') {
        throw AppError.badRequest("Query param 'format' must be 'docx' or 'pdf'");
      }
      const file = await this.workingPaperService.exportWorkingPaper(req.params.id, requested);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
}
