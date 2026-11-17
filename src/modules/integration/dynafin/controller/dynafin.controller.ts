import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { IDynafinService } from '../service/interface/dynafin.service.interface';

/** HTTP boundary for the optional, read-only Dynafin integration. GET routes only. */
export class DynafinController {
  public readonly router: Router = Router();

  constructor(private readonly service: IDynafinService) {
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);
    this.router.get('/status', requirePermission('integration:read'), this._status.bind(this));
    this.router.get('/status/check', requirePermission('integration:read'), this._checkStatus.bind(this));
  }

  /**
   * @route GET /integration/dynafin/status
   * @desc Whether Dynafin is enabled/configured and which driver is in use (no network call)
   * @access integration:read
   */
  private async _status(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(this.service.getStatus(), 'Dynafin status retrieved'));
    } catch (err) { next(err); }
  }

  /**
   * @route GET /integration/dynafin/status/check
   * @desc Live reachability/authentication check against Dynafin
   * @access integration:read
   */
  private async _checkStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.service.checkStatus(), 'Dynafin status checked'));
    } catch (err) { next(err); }
  }
}
