import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../../shared/types/api-response.type';
import {
  ApprovalActionRequestSchema,
  ApprovalEntityParamsSchema,
  PendingApprovalQuerySchema,
  RejectApprovalRequestSchema,
} from '../dto/request/approval.request.dto';
import { IApprovalService } from '../service/interface/approval.service.interface';

export class ApprovalController {
  public readonly router: Router;

  constructor(private readonly approvalService: IApprovalService) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    /**
     * @route  GET /workflow/approvals/pending
     * @desc   Get approval inbox for current user
     * @access Private - audit:read
     */
    this.router.get('/pending', requirePermission('audit:read'), validate(PendingApprovalQuerySchema, 'query'), this._getPendingApprovals.bind(this));

    /**
     * @route  GET /workflow/approvals/entity/:type/:id
     * @desc   Get latest approval for an entity
     * @access Private - audit:read
     */
    this.router.get('/entity/:type/:id', requirePermission('audit:read'), validate(ApprovalEntityParamsSchema, 'params'), this._getApprovalByEntity.bind(this));

    /**
     * @route  GET /workflow/approvals/:id
     * @desc   Get workflow approval
     * @access Private - audit:read
     */
    this.router.get('/:id', requirePermission('audit:read'), this._getApprovalById.bind(this));

    /**
     * @route  POST /workflow/approvals/:id/approve
     * @desc   Approve current workflow approval step
     * @access Private - audit:write
     */
    this.router.post('/:id/approve', requirePermission('audit:write'), validate(ApprovalActionRequestSchema), this._approve.bind(this));

    /**
     * @route  POST /workflow/approvals/:id/reject
     * @desc   Reject current workflow approval step
     * @access Private - audit:write
     */
    this.router.post('/:id/reject', requirePermission('audit:write'), validate(RejectApprovalRequestSchema), this._reject.bind(this));

    /**
     * @route  POST /workflow/approvals/:id/cancel
     * @desc   Cancel pending workflow approval
     * @access Private - audit:admin
     */
    this.router.post('/:id/cancel', requirePermission('audit:admin'), this._cancel.bind(this));
  }

  private async _getPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvals, meta } = await this.approvalService.getPendingApprovalsForUser(req.user!.id, req.query);
      res.status(200).json(buildResponse(approvals, 'Pending approvals retrieved', meta));
    } catch (err) {
      next(err);
    }
  }

  private async _getApprovalByEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approval = await this.approvalService.getApprovalByEntity(req.params.type as never, req.params.id);
      res.status(200).json(buildResponse(approval));
    } catch (err) {
      next(err);
    }
  }

  private async _getApprovalById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approval = await this.approvalService.getApprovalById(req.params.id);
      res.status(200).json(buildResponse(approval));
    } catch (err) {
      next(err);
    }
  }

  private async _approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approval = await this.approvalService.approve(req.params.id, req.user!.id, req.body.comment);
      res.status(200).json(buildResponse(approval, 'Approval step approved'));
    } catch (err) {
      next(err);
    }
  }

  private async _reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approval = await this.approvalService.reject(req.params.id, req.user!.id, req.body.reason);
      res.status(200).json(buildResponse(approval, 'Approval rejected'));
    } catch (err) {
      next(err);
    }
  }

  private async _cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approval = await this.approvalService.cancelApproval(req.params.id, req.user!);
      res.status(200).json(buildResponse(approval, 'Approval cancelled'));
    } catch (err) {
      next(err);
    }
  }
}
