import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { ISystemConfigService } from '../service/interface/system-config.service.interface';
import {
  BulkUpdateSystemConfigRequestSchema,
  UpdateSystemConfigRequestSchema,
} from '../dto/request/settings.request.dto';

export class SystemConfigController {
  public readonly router: Router;

  constructor(private readonly configService: ISystemConfigService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /settings/config
     * @desc   List all system configuration keys
     * @access Private - settings:read
     */
    this.router.get(
      '/',
      requirePermission('settings:read'),
      this._getAllConfig.bind(this),
    );

    /**
     * @route  GET /settings/config/public
     * @desc   List public system configuration keys
     * @access Private - authenticated
     */
    this.router.get(
      '/public',
      this._getPublicConfig.bind(this),
    );

    /**
     * @route  POST /settings/config/bulk-update
     * @desc   Update multiple system configuration keys
     * @access Private - settings:manage
     */
    this.router.post(
      '/bulk-update',
      requirePermission('settings:manage'),
      validate(BulkUpdateSystemConfigRequestSchema),
      this._bulkUpdateConfig.bind(this),
    );

    /**
     * @route  GET /settings/config/:key
     * @desc   Get one system configuration key
     * @access Private - settings:read
     */
    this.router.get(
      '/:key',
      requirePermission('settings:read'),
      this._getConfig.bind(this),
    );

    /**
     * @route  PUT /settings/config/:key
     * @desc   Update one system configuration key
     * @access Private - settings:manage
     */
    this.router.put(
      '/:key',
      requirePermission('settings:manage'),
      validate(UpdateSystemConfigRequestSchema),
      this._updateConfig.bind(this),
    );
  }

  private async _getAllConfig(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const configs = await this.configService.getAllConfig(true);
      res.status(200).json(buildResponse(configs));
    } catch (err) {
      next(err);
    }
  }

  private async _getPublicConfig(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const configs = await this.configService.getAllConfig(false);
      res.status(200).json(buildResponse(configs));
    } catch (err) {
      next(err);
    }
  }

  private async _getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await this.configService.getConfig(req.params.key);
      res.status(200).json(buildResponse(config));
    } catch (err) {
      next(err);
    }
  }

  private async _updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await this.configService.updateConfig(
        req.params.key,
        req.body.value,
        req.user!.id,
      );
      res.status(200).json(buildResponse(config, 'System config updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _bulkUpdateConfig(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const configs = await this.configService.bulkUpdateConfig(req.body, req.user!.id);
      res.status(200).json(buildResponse(configs, 'System config updated'));
    } catch (err) {
      next(err);
    }
  }
}
