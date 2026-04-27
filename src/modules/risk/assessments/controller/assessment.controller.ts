import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  CreateRiskAssessmentRequestSchema,
  RiskAssessmentQuerySchema,
} from '../dto/request/assessment.request.dto';
import { IAssessmentService } from '../service/interface/assessment.service.interface';

export class AssessmentController {
  public readonly router: Router;

  constructor(private readonly assessmentService: IAssessmentService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  POST /risk/register/:id/assessments
     * @desc   Create risk assessment
     * @access Private - audit:write
     */
    this.router.post('/register/:id/assessments', requirePermission('audit:write'), validate(CreateRiskAssessmentRequestSchema), this._createAssessment.bind(this));

    /**
     * @route  GET /risk/register/:id/assessments
     * @desc   List assessments for a risk
     * @access Private - audit:read
     */
    this.router.get('/register/:id/assessments', requirePermission('audit:read'), validate(RiskAssessmentQuerySchema, 'query'), this._listAssessments.bind(this));

    /**
     * @route  GET /risk/register/:id/assessments/latest
     * @desc   Get latest assessment for a risk
     * @access Private - audit:read
     */
    this.router.get('/register/:id/assessments/latest', requirePermission('audit:read'), this._getLatestAssessment.bind(this));

    /**
     * @route  GET /risk/assessments/:id
     * @desc   Get risk assessment by ID
     * @access Private - audit:read
     */
    this.router.get('/assessments/:id', requirePermission('audit:read'), this._getAssessmentById.bind(this));
  }

  private async _createAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assessment = await this.assessmentService.createAssessment(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(assessment, 'Risk assessment created'));
    } catch (err) {
      next(err);
    }
  }

  private async _getAssessmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assessment = await this.assessmentService.getAssessmentById(req.params.id, req.user!);
      res.status(200).json(buildResponse(assessment));
    } catch (err) {
      next(err);
    }
  }

  private async _listAssessments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assessments, meta } = await this.assessmentService.listAssessments(req.params.id, req.query as never, req.user!);
      res.status(200).json({ ...buildResponse(assessments), meta });
    } catch (err) {
      next(err);
    }
  }

  private async _getLatestAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assessment = await this.assessmentService.getLatestAssessment(req.params.id, req.user!);
      res.status(200).json(buildResponse(assessment));
    } catch (err) {
      next(err);
    }
  }
}
