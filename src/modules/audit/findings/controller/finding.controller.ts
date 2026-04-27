import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  CreateFindingRequestSchema,
  FindingQuerySchema,
  UpdateFindingRequestSchema,
  UpdateFindingStatusRequestSchema,
} from '../dto/request/finding.request.dto';
import { IFindingService } from '../service/interface/finding.service.interface';

export class FindingController {
  public readonly router: Router;

  constructor(private readonly findingService: IFindingService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /audit/engagements/:id/findings
     * @desc   Create finding
     * @access Private - finding:write
     */
    this.router.post('/engagements/:id/findings', requirePermission('finding:write'), validate(CreateFindingRequestSchema), this._createFinding.bind(this));

    /**
     * @route  GET /audit/engagements/:id/findings
     * @desc   List findings
     * @access Private - finding:read
     */
    this.router.get('/engagements/:id/findings', requirePermission('finding:read'), validate(FindingQuerySchema, 'query'), this._listFindings.bind(this));

    /**
     * @route  GET /audit/findings/:id
     * @desc   Get finding
     * @access Private - finding:read
     */
    this.router.get('/findings/:id', requirePermission('finding:read'), this._getFindingById.bind(this));

    /**
     * @route  PUT /audit/findings/:id
     * @desc   Update finding
     * @access Private - finding:write
     */
    this.router.put('/findings/:id', requirePermission('finding:write'), validate(UpdateFindingRequestSchema), this._updateFinding.bind(this));

    /**
     * @route  PATCH /audit/findings/:id/status
     * @desc   Update finding status
     * @access Private - finding:write
     */
    this.router.patch('/findings/:id/status', requirePermission('finding:write'), validate(UpdateFindingStatusRequestSchema), this._updateFindingStatus.bind(this));

    /**
     * @route  POST /audit/findings/:id/close
     * @desc   Close finding
     * @access Private - finding:write
     */
    this.router.post('/findings/:id/close', requirePermission('finding:write'), this._closeFinding.bind(this));
  }

  private async _createFinding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const finding = await this.findingService.createFinding(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(finding, 'Finding created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateFinding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const finding = await this.findingService.updateFinding(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(finding, 'Finding updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateFindingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const finding = await this.findingService.updateFindingStatus(req.params.id, req.body.status, req.user!);
      res.status(200).json(buildResponse(finding, 'Finding status updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _closeFinding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const finding = await this.findingService.closeFinding(req.params.id, req.user!);
      res.status(200).json(buildResponse(finding, 'Finding closed'));
    } catch (err) {
      next(err);
    }
  }

  private async _getFindingById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const finding = await this.findingService.getFindingById(req.params.id, req.user!);
      res.status(200).json(buildResponse(finding));
    } catch (err) {
      next(err);
    }
  }

  private async _listFindings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const findings = await this.findingService.listFindings(req.params.id, req.query as never, req.user!);
      res.status(200).json(buildResponse(findings));
    } catch (err) {
      next(err);
    }
  }
}
