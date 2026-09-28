import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  AuthoriseSecurityTestSchema,
  ChangeSecurityTestStatusSchema,
  CreateSecurityTestSchema,
  SecurityTestAssetsSchema,
  SecurityTestListQueryDto,
  SecurityTestListQuerySchema,
  UpdateSecurityTestSchema,
} from '../dto/request/security-test.request.dto';
import { ISecurityTestService } from '../service/interface/security-test.service.interface';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export class SecurityTestController {
  public readonly router: Router;

  constructor(private readonly securityTestService: ISecurityTestService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /system-audit/security-tests
     * @desc   List vulnerability assessments and penetration tests
     * @access Private - sectest:read
     */
    this.router.get('/', requirePermission('sectest:read'), validate(SecurityTestListQuerySchema, 'query'), this._list.bind(this));

    /**
     * @route  POST /system-audit/security-tests
     * @desc   Plan a security test (scope, schedule, provider, assets in scope)
     * @access Private - sectest:manage
     */
    this.router.post('/', requirePermission('sectest:manage'), validate(CreateSecurityTestSchema), this._create.bind(this));

    /**
     * @route  GET /system-audit/security-tests/:id
     * @desc   Security test detail with linked scan analyses and results
     * @access Private - sectest:read
     */
    this.router.get('/:id', requirePermission('sectest:read'), this._get.bind(this));

    /**
     * @route  PUT /system-audit/security-tests/:id
     * @desc   Update a security test (changing agreed terms voids an authorisation)
     * @access Private - sectest:manage
     */
    this.router.put('/:id', requirePermission('sectest:manage'), validate(UpdateSecurityTestSchema), this._update.bind(this));

    /**
     * @route  DELETE /system-audit/security-tests/:id
     * @desc   Soft-delete a planned or cancelled security test
     * @access Private - sectest:manage
     */
    this.router.delete('/:id', requirePermission('sectest:manage'), this._delete.bind(this));

    /**
     * @route  POST /system-audit/security-tests/:id/authorise
     * @desc   Give written authorisation to test (never the coordinator or creator)
     * @access Private - sectest:authorise
     */
    this.router.post(
      '/:id/authorise',
      requirePermission('sectest:authorise'),
      validate(AuthoriseSecurityTestSchema),
      this._authorise.bind(this),
    );

    /**
     * @route  PATCH /system-audit/security-tests/:id/status
     * @desc   Move the test through its lifecycle (in progress → reporting → remediation → closed)
     * @access Private - sectest:manage
     */
    this.router.patch(
      '/:id/status',
      requirePermission('sectest:manage'),
      validate(ChangeSecurityTestStatusSchema),
      this._changeStatus.bind(this),
    );

    /**
     * @route  POST /system-audit/security-tests/:id/assets
     * @desc   Add registry assets to the test scope
     * @access Private - sectest:manage
     */
    this.router.post('/:id/assets', requirePermission('sectest:manage'), validate(SecurityTestAssetsSchema), this._addAssets.bind(this));

    /**
     * @route  DELETE /system-audit/security-tests/:id/assets/:assetId
     * @desc   Remove an asset from the test scope
     * @access Private - sectest:manage
     */
    this.router.delete('/:id/assets/:assetId', requirePermission('sectest:manage'), this._removeAsset.bind(this));

    /**
     * @route  POST /system-audit/security-tests/:id/report
     * @desc   Attach (or version) the tester's report
     * @access Private - sectest:manage
     */
    this.router.post('/:id/report', requirePermission('sectest:manage'), upload.single('file'), this._uploadReport.bind(this));

    /**
     * @route  GET /system-audit/security-tests/:id/report
     * @desc   Download the current test report
     * @access Private - sectest:read
     */
    this.router.get('/:id/report', requirePermission('sectest:read'), this._downloadReport.bind(this));
  }

  private async _list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tests, meta } = await this.securityTestService.listTests(req.query as unknown as SecurityTestListQueryDto, req.user!);
      res.status(200).json(buildResponse(tests, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = await this.securityTestService.createTest(req.body, req.user!);
      res.status(201).json(buildResponse(test, 'Security test planned'));
    } catch (err) {
      next(err);
    }
  }

  private async _get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = await this.securityTestService.getTest(req.params.id, req.user!);
      res.status(200).json(buildResponse(test));
    } catch (err) {
      next(err);
    }
  }

  private async _update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = await this.securityTestService.updateTest(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(test, 'Security test updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.securityTestService.deleteTest(req.params.id, req.user!);
      res.status(200).json(buildResponse(null, 'Security test deleted'));
    } catch (err) {
      next(err);
    }
  }

  private async _authorise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = await this.securityTestService.authoriseTest(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(test, 'Security test authorised'));
    } catch (err) {
      next(err);
    }
  }

  private async _changeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = await this.securityTestService.changeStatus(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(test, 'Status updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _addAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = await this.securityTestService.addAssets(req.params.id, req.body, req.user!);
      res.status(200).json(buildResponse(test, 'Scope updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _removeAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = await this.securityTestService.removeAsset(req.params.id, req.params.assetId, req.user!);
      res.status(200).json(buildResponse(test, 'Scope updated'));
    } catch (err) {
      next(err);
    }
  }

  private async _uploadReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw AppError.badRequest('Attach the report (multipart field "file")');
      const test = await this.securityTestService.uploadReport(
        req.params.id,
        {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype || 'application/octet-stream',
          fileSize: req.file.size,
          buffer: req.file.buffer,
        },
        req.user!,
      );
      res.status(200).json(buildResponse(test, 'Report attached'));
    } catch (err) {
      next(err);
    }
  }

  private async _downloadReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await this.securityTestService.getReportFile(req.params.id, req.user!);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
}
