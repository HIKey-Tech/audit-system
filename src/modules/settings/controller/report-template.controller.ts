import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IReportTemplateService } from '../service/interface/report-template.service.interface';
import {
  CreateReportTemplateRequestSchema,
  ReportTemplateQuerySchema,
  UpdateReportTemplateRequestSchema,
} from '../dto/request/settings.request.dto';

export class ReportTemplateController {
  public readonly router: Router;

  constructor(private readonly templateService: IReportTemplateService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /settings/report-templates
     * @desc   List report templates
     * @access Private - settings:read
     */
    this.router.get(
      '/',
      requirePermission('settings:read'),
      validate(ReportTemplateQuerySchema, 'query'),
      this._listTemplates.bind(this),
    );

    /**
     * @route  GET /settings/report-templates/default
     * @desc   Get default report template
     * @access Private - settings:read
     */
    this.router.get(
      '/default',
      requirePermission('settings:read'),
      this._getDefaultTemplate.bind(this),
    );

    /**
     * @route  GET /settings/report-templates/variables
     * @desc   Get variables available in the default report template
     * @access Private - settings:read
     */
    this.router.get(
      '/variables',
      requirePermission('settings:read'),
      this._getAvailableVariables.bind(this),
    );

    /**
     * @route  GET /settings/report-templates/:id
     * @desc   Get report template by ID
     * @access Private - settings:read
     */
    this.router.get(
      '/:id',
      requirePermission('settings:read'),
      this._getTemplateById.bind(this),
    );

    /**
     * @route  POST /settings/report-templates
     * @desc   Create report template
     * @access Private - settings:manage
     */
    this.router.post(
      '/',
      requirePermission('report_template:manage'),
      validate(CreateReportTemplateRequestSchema),
      this._createTemplate.bind(this),
    );

    /**
     * @route  PUT /settings/report-templates/:id
     * @desc   Update report template
     * @access Private - settings:manage
     */
    this.router.put(
      '/:id',
      requirePermission('report_template:manage'),
      validate(UpdateReportTemplateRequestSchema),
      this._updateTemplate.bind(this),
    );

    /**
     * @route  POST /settings/report-templates/:id/set-default
     * @desc   Mark report template as system default
     * @access Private - settings:manage
     */
    this.router.post(
      '/:id/set-default',
      requirePermission('report_template:manage'),
      this._setDefaultTemplate.bind(this),
    );

    /**
     * @route  DELETE /settings/report-templates/:id
     * @desc   Deactivate report template
     * @access Private - settings:manage
     */
    this.router.delete(
      '/:id',
      requirePermission('report_template:manage'),
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
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const template = await this.templateService.getDefaultTemplate();
      res.status(200).json(buildResponse(template));
    } catch (err) {
      next(err);
    }
  }

  private async _getAvailableVariables(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const variables = await this.templateService.getAvailableVariables();
      res.status(200).json(buildResponse(variables));
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
      res.status(201).json(buildResponse(template, 'Report template created'));
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
      res.status(200).json(buildResponse(template, 'Report template updated'));
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
      res.status(200).json(buildResponse(template, 'Default report template updated'));
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
      res.status(200).json(buildResponse(null, 'Report template deactivated'));
    } catch (err) {
      next(err);
    }
  }
}
