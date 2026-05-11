// src/modules/messaging/controller/template.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { ITemplateService } from '../service/interface/template.service.interface';
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  TemplateQuerySchema,
} from '../dto/request/template.request.dto';

export class TemplateController {
  public readonly router: Router;

  constructor(private readonly templateService: ITemplateService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // All template routes require authentication
    this.router.use(authenticate);

    /**
     * @route  GET /notifications/templates
     * @desc   List notification templates (paginated, filterable by channel/eventKey/isActive)
     * @access Private — notification:read
     */
    this.router.get(
      '/',
      requirePermission('notification_template:read'),
      validate(TemplateQuerySchema, 'query'),
      this._listTemplates.bind(this),
    );

    /**
     * @route  POST /notifications/templates
     * @desc   Create a notification template
     * @access Private — audit:admin
     */
    this.router.post(
      '/',
      requirePermission('notification_template:write'),
      validate(CreateTemplateRequestSchema),
      this._createTemplate.bind(this),
    );

    /**
     * @route  GET /notifications/templates/:id
     * @desc   Get a notification template by ID
     * @access Private — notification:read
     */
    this.router.get(
      '/:id',
      requirePermission('notification_template:read'),
      this._getTemplateById.bind(this),
    );

    /**
     * @route  PATCH /notifications/templates/:id
     * @desc   Update a notification template
     * @access Private — audit:admin
     */
    this.router.patch(
      '/:id',
      requirePermission('notification_template:write'),
      validate(UpdateTemplateRequestSchema),
      this._updateTemplate.bind(this),
    );

    /**
     * @route  DELETE /notifications/templates/:id
     * @desc   Deactivate (soft-delete) a notification template
     * @access Private — audit:admin
     */
    this.router.delete(
      '/:id',
      requirePermission('notification_template:delete'),
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
      res.status(201).json(buildResponse(template, 'Notification template created'));
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
      res.status(200).json(buildResponse(template, 'Notification template updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deactivateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.templateService.deactivateTemplate(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(null, 'Notification template deactivated'));
    } catch (err) {
      next(err);
    }
  }
}
