import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requireAnyPermission, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  BulkCreateChecklistItemsRequestSchema,
  CreateChecklistItemRequestSchema,
  ImportFrameworkChecklistsRequestSchema,
  UpdateChecklistItemRequestSchema,
  UpdateChecklistTemplatesRequestSchema,
} from '../dto/request/checklist.request.dto';
import { AuditType } from '../../domain/enum/audit.enum';
import { IChecklistService } from '../service/interface/checklist.service.interface';

const checklistDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export class ChecklistController {
  public readonly router: Router;

  constructor(private readonly checklistService: IChecklistService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /audit/checklist-templates
     * @desc   Get the per-audit-type checklist control templates
     * @access Private - settings:read
     */
    this.router.get('/checklist-templates', requirePermission('settings:read'), this._getChecklistTemplates.bind(this));

    /**
     * @route  GET /audit/checklist-controls/:auditType
     * @desc   Preview the control set that would populate an engagement of this
     *         audit type — used by the create-engagement wizard to pre-fill the
     *         customisable per-engagement checklist.
     * @access Private - engagement:create
     */
    this.router.get('/checklist-controls/:auditType', requirePermission('engagement:create'), this._previewChecklistControls.bind(this));

    /**
     * @route  PUT /audit/checklist-templates
     * @desc   Replace the per-audit-type checklist control templates
     * @access Private - settings:manage
     */
    this.router.put('/checklist-templates', requirePermission('settings:manage'), validate(UpdateChecklistTemplatesRequestSchema), this._updateChecklistTemplates.bind(this));

    /**
     * @route  GET /audit/engagements/:id/checklists
     * @desc   Get engagement checklists
     * @access Private - audit:read
     */
    this.router.get('/engagements/:id/checklists', requirePermission('checklist:read'), this._getChecklists.bind(this));

    /**
     * @route  POST /audit/engagements/:id/checklists
     * @desc   Add a custom checklist item to an engagement
     * @access Private - checklist:create or checklist:update
     */
    this.router.post(
      '/engagements/:id/checklists',
      requireAnyPermission('checklist:create', 'checklist:update', 'engagement:create'),
      validate(CreateChecklistItemRequestSchema),
      this._createChecklistItem.bind(this),
    );

    /**
     * @route  POST /audit/engagements/:id/checklists/items
     * @desc   Bulk-add custom/previewed checklist controls to an engagement
     * @access Private - checklist:update
     */
    this.router.post(
      '/engagements/:id/checklists/items',
      requireAnyPermission('checklist:update', 'checklist:create', 'engagement:create'),
      validate(BulkCreateChecklistItemsRequestSchema),
      this._bulkCreateChecklistItems.bind(this),
    );

    /**
     * @route  POST /audit/engagements/:id/checklists/import-framework
     * @desc   Import active controls from one or more compliance frameworks into an engagement checklist
     * @access Private - checklist:update or engagement:create
     */
    this.router.post(
      '/engagements/:id/checklists/import-framework',
      requireAnyPermission('checklist:update', 'checklist:create', 'engagement:create'),
      validate(ImportFrameworkChecklistsRequestSchema),
      this._importFrameworkControls.bind(this),
    );

    /**
     * @route  POST /audit/engagements/:id/checklists/import-document
     * @desc   Extract controls from an uploaded Act/Policy/Framework document and import into engagement checklist
     * @access Private - checklist:update or engagement:create
     */
    this.router.post(
      '/engagements/:id/checklists/import-document',
      requireAnyPermission('checklist:update', 'checklist:create', 'engagement:create'),
      checklistDocumentUpload.single('file'),
      this._importDocumentControls.bind(this),
    );

    /**
     * @route  GET /audit/engagements/:id/checklists/progress
     * @desc   Get checklist progress
     * @access Private - audit:read
     */
    this.router.get('/engagements/:id/checklists/progress', requirePermission('checklist:read'), this._getChecklistProgress.bind(this));

    /**
     * @route  PATCH /audit/checklists/:id
     * @desc   Update checklist item
     * @access Private - audit:write
     */
    this.router.patch('/checklists/:id', requirePermission('checklist:update'), validate(UpdateChecklistItemRequestSchema), this._updateChecklistItem.bind(this));

    /**
     * @route  POST /audit/checklists/:id/evidence/:evidenceId
     * @desc   Link evidence to checklist item
     * @access Private - audit:write
     */
    this.router.post('/checklists/:id/evidence/:evidenceId', requirePermission('checklist:update'), this._linkEvidenceToChecklistItem.bind(this));
  }

  private async _getChecklistTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await this.checklistService.getChecklistTemplates();
      res.status(200).json(buildResponse(templates));
    } catch (err) {
      next(err);
    }
  }

  private async _updateChecklistTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await this.checklistService.updateChecklistTemplates(req.body, req.user!);
      res.status(200).json(buildResponse(templates, 'Checklist templates updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _previewChecklistControls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const controls = await this.checklistService.previewControlsForAuditType(req.params.auditType as AuditType);
      res.status(200).json(buildResponse(controls));
    } catch (err) {
      next(err);
    }
  }

  private async _getChecklists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const checklists = await this.checklistService.getChecklists(req.params.id, req.user!);
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

  private async _createChecklistItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await this.checklistService.createChecklistItem(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(item, 'Checklist item added'));
    } catch (err) {
      next(err);
    }
  }

  private async _bulkCreateChecklistItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.checklistService.bulkCreateChecklistItems(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(result, `${result.addedCount} checklist item(s) added`));
    } catch (err) {
      next(err);
    }
  }

  private async _importFrameworkControls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.checklistService.importFrameworkControls(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(result, `${result.addedCount} control(s) imported from framework`));
    } catch (err) {
      next(err);
    }
  }

  private async _importDocumentControls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let parsedControls = req.body?.controls;
      if (typeof parsedControls === 'string' && parsedControls.trim()) {
        try {
          parsedControls = JSON.parse(parsedControls);
        } catch {
          parsedControls = undefined;
        }
      }
      const saveToLibrary =
        req.body?.saveToLibrary === true ||
        req.body?.saveToLibrary === 'true' ||
        req.body?.saveToLibrary === '1';

      const result = await this.checklistService.importDocumentControls(
        req.params.id,
        req.file,
        {
          prefix: req.body?.prefix || undefined,
          saveToLibrary,
          frameworkName: req.body?.frameworkName || undefined,
          frameworkCode: req.body?.frameworkCode || undefined,
          category: req.body?.category || undefined,
          auditType: req.body?.auditType || undefined,
          controls: Array.isArray(parsedControls) ? parsedControls : undefined,
        },
        req.user!,
      );
      res.status(201).json(buildResponse(result, `${result.addedCount} control(s) imported from document`));
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
