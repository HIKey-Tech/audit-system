import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  AccessItemExportQueryDto,
  AccessItemExportQuerySchema,
  AccessItemListQueryDto,
  AccessItemListQuerySchema,
  DecideAccessItemsSchema,
} from '../dto/request/access-review.request.dto';
import { IAccessReviewService } from '../service/interface/access-review.service.interface';

export class AccessReviewController {
  public readonly router: Router;

  constructor(private readonly accessReviewService: IAccessReviewService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /system-audit/access-reviews/:runId/items
     * @desc   Accounts in a user access review, with their flags and decisions
     * @access Private - sysaudit:read
     */
    this.router.get(
      '/:runId/items',
      requirePermission('sysaudit:read'),
      validate(AccessItemListQuerySchema, 'query'),
      this._listItems.bind(this),
    );

    /**
     * @route  GET /system-audit/access-reviews/:runId/items/export
     * @desc   Export the access review worksheet (accounts, access, decisions)
     * @access Private - sysaudit:read
     */
    this.router.get(
      '/:runId/items/export',
      requirePermission('sysaudit:read'),
      validate(AccessItemExportQuerySchema, 'query'),
      this._exportItems.bind(this),
    );

    /**
     * @route  POST /system-audit/access-reviews/:runId/decisions
     * @desc   Record access decisions (appropriate / revoke / modify) for accounts
     * @access Private - sysaudit:review
     */
    this.router.post(
      '/:runId/decisions',
      requirePermission('sysaudit:review'),
      validate(DecideAccessItemsSchema),
      this._decide.bind(this),
    );
  }

  private async _listItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, meta } = await this.accessReviewService.listItems(
        req.params.runId,
        req.query as unknown as AccessItemListQueryDto,
        req.user!,
      );
      res.status(200).json(buildResponse(items, 'Success', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _exportItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { format } = req.query as unknown as AccessItemExportQueryDto;
      const file = await this.accessReviewService.exportItems(req.params.runId, format, req.user!);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }

  private async _decide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.accessReviewService.decideItems(req.params.runId, req.body, req.user!);
      res.status(200).json(buildResponse(result, 'Decisions recorded'));
    } catch (err) {
      next(err);
    }
  }
}
