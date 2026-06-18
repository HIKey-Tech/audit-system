import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { AppError } from '../../../shared/errors/app.error';
import { IWorkingPaperTemplateService } from '../service/interface/working-paper-template.service.interface';
import {
  CreateWorkingPaperTemplateRequestSchema,
  UpdateWorkingPaperTemplateRequestSchema,
  WorkingPaperTemplateQuerySchema,
} from '../dto/request/settings.request.dto';
import { SETTINGS_AUDIT_TYPES, SettingsAuditType } from '../domain/enum/settings.enum';

export class WorkingPaperTemplateController {
  public readonly router: Router;

  constructor(private readonly templateService: IWorkingPaperTemplateService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /settings/working-paper-templates
     * @desc   List working paper templates
     * @access Private - working_paper:read (templates feed working-paper creation)
     */
    this.router.get(
      '/',
      requirePermission('working_paper:read'),
      validate(WorkingPaperTemplateQuerySchema, 'query'),
      this._listTemplates.bind(this),
    );

    /**
     * @route  GET /settings/working-paper-templates/default/:auditType
     * @desc   Get default working paper template for an audit type
     * @access Private - working_paper:read (templates feed working-paper creation)
     */
    this.router.get(
      '/default/:auditType',
      requirePermission('working_paper:read'),
      this._getDefaultTemplate.bind(this),
    );

    /**
     * @route  GET /settings/working-paper-templates/:id
     * @desc   Get working paper template by ID
     * @access Private - working_paper:read (templates feed working-paper creation)
     */
    this.router.get(
      '/:id',
      requirePermission('working_paper:read'),
      this._getTemplateById.bind(this),
    );

    /**
     * @route  POST /settings/working-paper-templates
     * @desc   Create working paper template
     * @access Private - settings:manage
     */
    this.router.post(
      '/',
      requirePermission('settings:manage'),
      validate(CreateWorkingPaperTemplateRequestSchema),
      this._createTemplate.bind(this),
    );

    /**
     * @route  PUT /settings/working-paper-templates/:id
     * @desc   Update working paper template
     * @access Private - settings:manage
     */
    this.router.put(
      '/:id',
      requirePermission('settings:manage'),
      validate(UpdateWorkingPaperTemplateRequestSchema),
      this._updateTemplate.bind(this),
    );

    /**
     * @route  POST /settings/working-paper-templates/:id/set-default
     * @desc   Mark working paper template as default for its audit type
     * @access Private - settings:manage
     */
    this.router.post(
      '/:id/set-default',
      requirePermission('settings:manage'),
      this._setDefaultTemplate.bind(this),
    );

    /**
     * @route  DELETE /settings/working-paper-templates/:id
     * @desc   Deactivate working paper template
     * @access Private - settings:manage
     */
    this.router.delete(
      '/:id',
      requirePermission('settings:manage'),
      this._deactivateTemplate.bind(this),
    );
  }

  private async _listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { templates, meta } = await this.templateService.listTemplates(req.query as never);
      res.status(200).json(buildResponse(templates, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _getDefaultTemplate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const auditType = req.params.auditType;
      if (!SETTINGS_AUDIT_TYPES.includes(auditType as SettingsAuditType)) {
        throw AppError.badRequest('Invalid audit type');
      }

      const template = await this.templateService.getDefaultTemplate(auditType as SettingsAuditType);
      res.status(200).json(buildResponse(template));
    } catch (err) {
      next(err);
    }
  }

  private async _getTemplateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await this.templateService.getTemplateById(req.params.id);
      res.status(200).json(buildResponse(template));
    } catch (err) {
      next(err);
    }
  }

  private async _createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await this.templateService.createTemplate(req.body, req.user!.id);
      res.status(201).json(buildResponse(template, 'Working paper template created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await this.templateService.updateTemplate(
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.status(200).json(buildResponse(template, 'Working paper template updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _setDefaultTemplate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const template = await this.templateService.setDefaultTemplate(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(template, 'Default working paper template updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deactivateTemplate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await this.templateService.deactivateTemplate(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(null, 'Working paper template deactivated'));
    } catch (err) {
      next(err);
    }
  }
}
