import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { IDirectoryMappingService } from '../service/interface/directory.service.interface';
import { CreateMappingSchema, UpdateMappingSchema } from '../dto/request/directory.request.dto';
import { mapMappingToResponse } from '../dto/response/directory.response.dto';

export class DirectoryMappingController {
  public readonly router: Router = Router();

  constructor(private readonly service: IDirectoryMappingService) {
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.get(
      '/mappings',
      authenticate,
      requirePermission('settings:read'),
      this._list.bind(this),
    );
    this.router.post(
      '/mappings',
      authenticate,
      requirePermission('settings:manage'),
      validate(CreateMappingSchema),
      this._create.bind(this),
    );
    this.router.patch(
      '/mappings/:id',
      authenticate,
      requirePermission('settings:manage'),
      validate(UpdateMappingSchema),
      this._update.bind(this),
    );
    this.router.delete(
      '/mappings/:id',
      authenticate,
      requirePermission('settings:manage'),
      this._delete.bind(this),
    );
    this.router.post(
      '/sync',
      authenticate,
      requirePermission('settings:manage'),
      this._sync.bind(this),
    );
  }

  /** @route GET /integration/directory/mappings @desc List group→role mappings @access settings:read */
  private async _list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await this.service.listMappings();
      res.json(buildResponse(rows.map(mapMappingToResponse), 'Directory mappings retrieved'));
    } catch (err) {
      next(err);
    }
  }

  /** @route POST /integration/directory/mappings @desc Create a mapping @access settings:manage */
  private async _create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const m = await this.service.createMapping(req.body, req.user!.id);
      res.status(201).json(buildResponse(mapMappingToResponse(m), 'Mapping created'));
    } catch (err) {
      next(err);
    }
  }

  /** @route PATCH /integration/directory/mappings/:id @desc Update a mapping @access settings:manage */
  private async _update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const m = await this.service.updateMapping(req.params.id, req.body, req.user!.id);
      res.json(buildResponse(mapMappingToResponse(m), 'Mapping updated'));
    } catch (err) {
      next(err);
    }
  }

  /** @route DELETE /integration/directory/mappings/:id @desc Delete a mapping @access settings:manage */
  private async _delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.deleteMapping(req.params.id, req.user!.id);
      res.json(buildResponse(null, 'Mapping deleted'));
    } catch (err) {
      next(err);
    }
  }

  /** @route POST /integration/directory/sync @desc Trigger a full directory sync @access settings:manage */
  private async _sync(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.service.runFullDirectorySync();
      res.json(buildResponse(result, 'Directory sync complete'));
    } catch (err) {
      next(err);
    }
  }
}
