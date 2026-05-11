import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  CreateUniverseRequestSchema,
  UpdateUniverseRequestSchema,
  UniverseQuerySchema,
} from '../dto/request/universe.request.dto';
import { IUniverseService } from '../service/interface/universe.service.interface';

export class UniverseController {
  public readonly router: Router;

  constructor(private readonly universeService: IUniverseService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/universe
     * @desc   Create audit universe entity
     * @access Private - audit:write
     */
    this.router.post('/', requirePermission('universe:create'), validate(CreateUniverseRequestSchema), this._createEntity.bind(this));

    /**
     * @route  GET /audit/universe
     * @desc   List audit universe entities
     * @access Private - audit:read
     */
    this.router.get('/', requirePermission('universe:read'), validate(UniverseQuerySchema, 'query'), this._listEntities.bind(this));

    /**
     * @route  GET /audit/universe/:id
     * @desc   Get audit universe entity
     * @access Private - audit:read
     */
    this.router.get('/:id', requirePermission('universe:read'), this._getEntityById.bind(this));

    /**
     * @route  PUT /audit/universe/:id
     * @desc   Update audit universe entity
     * @access Private - audit:write
     */
    this.router.put('/:id', requirePermission('universe:update'), validate(UpdateUniverseRequestSchema), this._updateEntity.bind(this));

    /**
     * @route  DELETE /audit/universe/:id
     * @desc   Deactivate audit universe entity
     * @access Private - audit:delete
     */
    this.router.delete('/:id', requirePermission('universe:delete'), this._deactivateEntity.bind(this));
  }

  private async _createEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = await this.universeService.createEntity(req.body, req.user!);
      res.status(201).json(buildResponse(entity, 'Audit universe entity created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = await this.universeService.updateEntity(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(entity, 'Audit universe entity updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deactivateEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.universeService.deactivateEntity(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Audit universe entity deactivated'));
    } catch (err) {
      next(err);
    }
  }

  private async _getEntityById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entity = await this.universeService.getEntityById(req.params.id, req.user!);
      res.status(200).json(buildResponse(entity));
    } catch (err) {
      next(err);
    }
  }

  private async _listEntities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entities, meta } = await this.universeService.listEntities(req.query as never);
      res.status(200).json({ ...buildResponse(entities), meta });
    } catch (err) {
      next(err);
    }
  }
}
