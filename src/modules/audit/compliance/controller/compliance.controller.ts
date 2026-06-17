import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  ControlQuerySchema,
  CreateControlRequestSchema,
  CreateFrameworkRequestSchema,
  LinkRiskRequestSchema,
  UpdateControlRequestSchema,
  UpdateFrameworkRequestSchema,
} from '../dto/request/compliance.request.dto';
import { IComplianceService } from '../service/interface/compliance.service.interface';

export class ComplianceController {
  public readonly router: Router;

  constructor(private readonly complianceService: IComplianceService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /audit/compliance/coverage
     * @desc   Per-framework control coverage summary
     * @access Private - control:read
     */
    this.router.get('/compliance/coverage', requirePermission('control:read'), this._getCoverage.bind(this));

    /**
     * @route  GET /audit/compliance/tested-coverage
     * @desc   Per-framework assurance coverage — controls exercised, pass/fail
     * @access Private - control:read
     */
    this.router.get('/compliance/tested-coverage', requirePermission('control:read'), this._getTestedCoverage.bind(this));

    /**
     * @route  GET /audit/compliance/risk-coverage
     * @desc   Per-risk control coverage — mapped & tested controls per register risk
     * @access Private - control:read
     */
    this.router.get('/compliance/risk-coverage', requirePermission('control:read'), this._getRiskCoverage.bind(this));

    /**
     * @route  GET /audit/compliance/controls/:id/risks
     * @desc   List risks a control is mapped to
     * @access Private - control:read
     */
    this.router.get('/compliance/controls/:id/risks', requirePermission('control:read'), this._listControlRisks.bind(this));

    /**
     * @route  POST /audit/compliance/controls/:id/risks
     * @desc   Map a control to a risk it mitigates
     * @access Private - control:manage
     */
    this.router.post('/compliance/controls/:id/risks', requirePermission('control:manage'), validate(LinkRiskRequestSchema), this._linkRisk.bind(this));

    /**
     * @route  DELETE /audit/compliance/controls/:id/risks/:riskId
     * @desc   Remove a control–risk mapping
     * @access Private - control:manage
     */
    this.router.delete('/compliance/controls/:id/risks/:riskId', requirePermission('control:manage'), this._unlinkRisk.bind(this));

    /**
     * @route  GET /audit/compliance/frameworks
     * @desc   List compliance frameworks
     * @access Private - control:read
     */
    this.router.get('/compliance/frameworks', requirePermission('control:read'), this._listFrameworks.bind(this));

    /**
     * @route  POST /audit/compliance/frameworks
     * @desc   Create a compliance framework
     * @access Private - control:manage
     */
    this.router.post('/compliance/frameworks', requirePermission('control:manage'), validate(CreateFrameworkRequestSchema), this._createFramework.bind(this));

    /**
     * @route  PUT /audit/compliance/frameworks/:id
     * @desc   Update a compliance framework
     * @access Private - control:manage
     */
    this.router.put('/compliance/frameworks/:id', requirePermission('control:manage'), validate(UpdateFrameworkRequestSchema), this._updateFramework.bind(this));

    /**
     * @route  GET /audit/compliance/controls
     * @desc   List compliance controls
     * @access Private - control:read
     */
    this.router.get('/compliance/controls', requirePermission('control:read'), validate(ControlQuerySchema, 'query'), this._listControls.bind(this));

    /**
     * @route  POST /audit/compliance/controls
     * @desc   Create a compliance control
     * @access Private - control:manage
     */
    this.router.post('/compliance/controls', requirePermission('control:manage'), validate(CreateControlRequestSchema), this._createControl.bind(this));

    /**
     * @route  PUT /audit/compliance/controls/:id
     * @desc   Update a compliance control
     * @access Private - control:manage
     */
    this.router.put('/compliance/controls/:id', requirePermission('control:manage'), validate(UpdateControlRequestSchema), this._updateControl.bind(this));

    /**
     * @route  DELETE /audit/compliance/controls/:id
     * @desc   Retire (soft-delete) a compliance control
     * @access Private - control:manage
     */
    this.router.delete('/compliance/controls/:id', requirePermission('control:manage'), this._deleteControl.bind(this));
  }

  private async _getCoverage(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coverage = await this.complianceService.getCoverage();
      res.status(200).json(buildResponse(coverage));
    } catch (err) {
      next(err);
    }
  }

  private async _getTestedCoverage(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coverage = await this.complianceService.getTestedCoverage();
      res.status(200).json(buildResponse(coverage));
    } catch (err) {
      next(err);
    }
  }

  private async _getRiskCoverage(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coverage = await this.complianceService.getRiskCoverage();
      res.status(200).json(buildResponse(coverage));
    } catch (err) {
      next(err);
    }
  }

  private async _listControlRisks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const risks = await this.complianceService.listControlRisks(req.params.id);
      res.status(200).json(buildResponse(risks));
    } catch (err) {
      next(err);
    }
  }

  private async _linkRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const risks = await this.complianceService.linkRisk(req.params.id, req.body.riskId, req.user!);
      res.status(201).json(buildResponse(risks, 'Risk mapped to control'));
    } catch (err) {
      next(err);
    }
  }

  private async _unlinkRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.complianceService.unlinkRisk(req.params.id, req.params.riskId, req.user!);
      res.status(200).json(buildResponse(null, 'Risk mapping removed'));
    } catch (err) {
      next(err);
    }
  }

  private async _listFrameworks(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const frameworks = await this.complianceService.listFrameworks();
      res.status(200).json(buildResponse(frameworks));
    } catch (err) {
      next(err);
    }
  }

  private async _createFramework(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const framework = await this.complianceService.createFramework(req.body, req.user!);
      res.status(201).json(buildResponse(framework, 'Compliance framework created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateFramework(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const framework = await this.complianceService.updateFramework(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(framework, 'Compliance framework updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _listControls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.complianceService.listControls(req.query as never);
      res.status(200).json(buildResponse(result.controls, 'Success', result.meta));
    } catch (err) {
      next(err);
    }
  }

  private async _createControl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const control = await this.complianceService.createControl(req.body, req.user!);
      res.status(201).json(buildResponse(control, 'Compliance control created'));
    } catch (err) {
      next(err);
    }
  }

  private async _updateControl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const control = await this.complianceService.updateControl(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(control, 'Compliance control updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _deleteControl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.complianceService.deleteControl(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Compliance control retired'));
    } catch (err) {
      next(err);
    }
  }
}
