import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  CreateRiskRequestSchema,
  RiskRegisterQuerySchema,
  UpdateRiskRequestSchema,
  UpdateRiskStatusRequestSchema,
} from '../dto/request/register.request.dto';
import { IRegisterService } from '../service/interface/register.service.interface';

export class RegisterController {
  public readonly router: Router;

  constructor(private readonly registerService: IRegisterService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /risk/register
     * @desc   Create risk register item
     * @access Private - audit:write
     */
    this.router.post('/', requirePermission('audit:write'), validate(CreateRiskRequestSchema), this._createRisk.bind(this));

    /**
     * @route  GET /risk/register
     * @desc   List risk register items
     * @access Private - audit:read
     */
    this.router.get('/', requirePermission('audit:read'), validate(RiskRegisterQuerySchema, 'query'), this._listRisks.bind(this));

    /**
     * @route  GET /risk/register/universe/:universeId
     * @desc   List risks linked to audit universe entity
     * @access Private - audit:read
     */
    this.router.get('/universe/:universeId', requirePermission('audit:read'), this._getRisksByUniverseEntity.bind(this));

    /**
     * @route  GET /risk/register/:id
     * @desc   Get risk register item
     * @access Private - audit:read
     */
    this.router.get('/:id', requirePermission('audit:read'), this._getRiskById.bind(this));

    /**
     * @route  PUT /risk/register/:id
     * @desc   Update risk register item
     * @access Private - audit:write
     */
    this.router.put('/:id', requirePermission('audit:write'), validate(UpdateRiskRequestSchema), this._updateRisk.bind(this));

    /**
     * @route  PATCH /risk/register/:id/status
     * @desc   Update risk status
     * @access Private - audit:write
     */
    this.router.patch('/:id/status', requirePermission('audit:write'), validate(UpdateRiskStatusRequestSchema), this._updateRiskStatus.bind(this));

    /**
     * @route  DELETE /risk/register/:id
     * @desc   Soft-delete risk
     * @access Private - audit:delete
     */
    this.router.delete('/:id', requirePermission('audit:delete'), this._deleteRisk.bind(this));
  }

  private async _createRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const risk = await this.registerService.createRisk(req.body, req.user!);
      res.status(201).json(buildResponse(risk, 'Risk created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const risk = await this.registerService.updateRisk(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(risk, 'Risk updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateRiskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const risk = await this.registerService.updateRiskStatus(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(risk, 'Risk status updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deleteRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.registerService.deleteRisk(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Risk deleted'));
    } catch (err) {
      next(err);
    }
  }

  private async _getRiskById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const risk = await this.registerService.getRiskById(req.params.id, req.user!);
      res.status(200).json(buildResponse(risk));
    } catch (err) {
      next(err);
    }
  }

  private async _listRisks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { risks, meta } = await this.registerService.listRisks(req.query as never, req.user!);
      res.status(200).json({ ...buildResponse(risks), meta });
    } catch (err) {
      next(err);
    }
  }

  private async _getRisksByUniverseEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const risks = await this.registerService.getRisksByUniverseEntity(req.params.universeId, req.user!);
      res.status(200).json(buildResponse(risks));
    } catch (err) {
      next(err);
    }
  }
}
