import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { UpdateChecklistItemRequestSchema } from '../dto/request/checklist.request.dto';
import { IChecklistService } from '../service/interface/checklist.service.interface';

export class ChecklistController {
  public readonly router: Router;

  constructor(private readonly checklistService: IChecklistService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /audit/engagements/:id/checklists
     * @desc   Get engagement checklists
     * @access Private - audit:read
     */
    this.router.get('/engagements/:id/checklists', requirePermission('audit:read'), this._getChecklists.bind(this));

    /**
     * @route  GET /audit/engagements/:id/checklists/progress
     * @desc   Get checklist progress
     * @access Private - audit:read
     */
    this.router.get('/engagements/:id/checklists/progress', requirePermission('audit:read'), this._getChecklistProgress.bind(this));

    /**
     * @route  PATCH /audit/checklists/:id
     * @desc   Update checklist item
     * @access Private - audit:write
     */
    this.router.patch('/checklists/:id', requirePermission('audit:write'), validate(UpdateChecklistItemRequestSchema), this._updateChecklistItem.bind(this));

    /**
     * @route  POST /audit/checklists/:id/evidence/:evidenceId
     * @desc   Link evidence to checklist item
     * @access Private - audit:write
     */
    this.router.post('/checklists/:id/evidence/:evidenceId', requirePermission('audit:write'), this._linkEvidenceToChecklistItem.bind(this));
  }

  private async _getChecklists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const checklists = await this.checklistService.getChecklists(req.params.id);
      res.status(200).json(buildResponse(checklists));
    } catch (err) {
      next(err);
    }
  }

  private async _getChecklistProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const progress = await this.checklistService.getChecklistProgress(req.params.id);
      res.status(200).json(buildResponse(progress));
    } catch (err) {
      next(err);
    }
  }

  private async _updateChecklistItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await this.checklistService.updateChecklistItem(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(item, 'Checklist item updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _linkEvidenceToChecklistItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await this.checklistService.linkEvidenceToChecklistItem(req.params.id, req.params.evidenceId, req.user!);
      res.status(200).json(buildResponse(item, 'Evidence linked to checklist item'));
    } catch (err) {
      next(err);
    }
  }
}
