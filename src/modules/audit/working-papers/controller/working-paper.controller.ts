import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  CreateWorkingPaperRequestSchema,
  RejectWorkingPaperRequestSchema,
  UpdateWorkingPaperRequestSchema,
} from '../dto/request/working-paper.request.dto';
import { IWorkingPaperService } from '../service/interface/working-paper.service.interface';

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
     * @access Private - audit:write
     */
    this.router.post('/engagements/:id/working-papers', requirePermission('working_paper:create'), validate(CreateWorkingPaperRequestSchema), this._createWorkingPaper.bind(this));

    /**
     * @route  GET /audit/engagements/:id/working-papers
     * @desc   List working papers
     * @access Private - audit:read
     */
    this.router.get('/engagements/:id/working-papers', requirePermission('working_paper:read'), this._listWorkingPapers.bind(this));

    /**
     * @route  GET /audit/working-papers/:id
     * @desc   Get working paper
     * @access Private - audit:read
     */
    this.router.get('/working-papers/:id', requirePermission('working_paper:read'), this._getWorkingPaperById.bind(this));

    /**
     * @route  PUT /audit/working-papers/:id
     * @desc   Update working paper
     * @access Private - audit:write
     */
    this.router.put('/working-papers/:id', requirePermission('working_paper:update'), validate(UpdateWorkingPaperRequestSchema), this._updateWorkingPaper.bind(this));

    /**
     * @route  POST /audit/working-papers/:id/submit
     * @desc   Submit working paper
     * @access Private - audit:write
     */
    this.router.post('/working-papers/:id/submit', requirePermission('working_paper:submit'), this._submitWorkingPaper.bind(this));

    /**
     * @route  POST /audit/working-papers/:id/approve
     * @desc   Approve working paper
     * @access Private - audit:write
     */
    this.router.post('/working-papers/:id/approve', requirePermission('working_paper:approve'), this._approveWorkingPaper.bind(this));

    /**
     * @route  POST /audit/working-papers/:id/reject
     * @desc   Reject working paper
     * @access Private - audit:write
     */
    this.router.post('/working-papers/:id/reject', requirePermission('working_paper:reject'), validate(RejectWorkingPaperRequestSchema), this._rejectWorkingPaper.bind(this));

    /**
     * @route  GET /audit/working-papers/:id/export
     * @desc   Export working paper
     * @access Private - audit:read
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
      const paper = await this.workingPaperService.approveWorkingPaper(req.params.id, req.user!);
      res.status(200).json(buildResponse(paper, 'Working paper approved'));
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
      const paper = await this.workingPaperService.getWorkingPaperById(req.params.id);
      res.status(200).json(buildResponse(paper));
    } catch (err) {
      next(err);
    }
  }

  private async _listWorkingPapers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const papers = await this.workingPaperService.listWorkingPapers(req.params.id);
      res.status(200).json(buildResponse(papers));
    } catch (err) {
      next(err);
    }
  }

  private async _exportWorkingPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await this.workingPaperService.exportWorkingPaper(req.params.id);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
}
