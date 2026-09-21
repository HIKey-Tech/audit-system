import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { IEngagementService } from '../../../audit/engagement/service/interface/engagement.service.interface';
import { IImocTicketService } from '../service/interface/imoc-ticket.service.interface';
import {
  ImocModelLookupSchema,
  ImocSyncRequestSchema,
  ImocTicketLookupRequestSchema,
  LinkImocTicketSchema,
  SearchImocTicketsSchema,
} from '../dto/request/imoc.request.dto';

/** HTTP boundary for the optional, read-only IMOC ticket integration. */
export class ImocTicketController {
  public readonly router: Router = Router();

  constructor(
    private readonly imocService: IImocTicketService,
    private readonly engagementService: IEngagementService,
  ) {
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);
    this.router.get('/status', requirePermission('integration:read'), this._status.bind(this));
    this.router.post('/tickets/search', requirePermission('imoc:read'), validate(SearchImocTicketsSchema), this._search.bind(this));
    this.router.post('/tickets/detail', requirePermission('imoc:read'), validate(ImocTicketLookupRequestSchema), this._detail.bind(this));
    this.router.post('/models/detail', requirePermission('imoc:read'), validate(ImocModelLookupSchema), this._model.bind(this));
    this.router.post('/sync', requirePermission('imoc:sync'), validate(ImocSyncRequestSchema), this._sync.bind(this));

    this.router.get('/engagements/:id/tickets', requirePermission('imoc:read'), this._listLinks.bind(this));
    this.router.post('/engagements/:id/tickets', requirePermission('imoc:link'), validate(LinkImocTicketSchema), this._link.bind(this));
    this.router.delete('/tickets/:id', requirePermission('imoc:link'), this._unlink.bind(this));
    this.router.post('/tickets/:id/refresh', requirePermission('imoc:sync'), this._refresh.bind(this));
    this.router.post('/tickets/:id/capture', requirePermission('imoc:capture'), this._capture.bind(this));
    this.router.get('/tickets/:id/snapshots', requirePermission('imoc:read'), this._snapshots.bind(this));
  }

  /** @route GET /integration/imoc/status @desc View non-secret IMOC availability @access integration:read */
  private async _status(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.getStatus()));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/imoc/tickets/search @desc Search IMOC tickets read-only @access imoc:read */
  private async _search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.searchTickets(req.body, req.user!)));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/imoc/tickets/detail @desc Read one IMOC ticket @access imoc:read */
  private async _detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.getTicket(req.body, req.user!)));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/imoc/models/detail @desc Read safe IMOC model metadata @access imoc:read */
  private async _model(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.getModel(req.body.modelId, req.user!)));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/imoc/sync @desc Refresh a small batch of already-linked tickets @access imoc:sync */
  private async _sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.syncActiveLinks(req.body.limit), 'IMOC linked-ticket refresh complete'));
    } catch (err) { next(err); }
  }

  /** @route GET /integration/imoc/engagements/:id/tickets @desc List engagement IMOC links @access imoc:read */
  private async _listLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this._assertInternalEngagementAccess(req.params.id, req.user!);
      res.json(buildResponse(await this.imocService.listLinks(req.params.id, req.user!)));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/imoc/engagements/:id/tickets @desc Link an existing IMOC ticket @access imoc:link */
  private async _link(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this._assertInternalEngagementAccess(req.params.id, req.user!);
      const link = await this.imocService.linkTicket(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(link, 'IMOC ticket linked to engagement'));
    } catch (err) { next(err); }
  }

  /** @route DELETE /integration/imoc/tickets/:id @desc Remove an IMOC engagement link @access imoc:link */
  private async _unlink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.imocService.getLink(req.params.id);
      await this._assertInternalEngagementAccess(link.engagementId, req.user!);
      await this.imocService.unlinkTicket(req.params.id, req.user!);
      res.json(buildResponse(null, 'IMOC ticket unlinked from engagement'));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/imoc/tickets/:id/refresh @desc Refresh one existing IMOC ticket link @access imoc:sync */
  private async _refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.imocService.getLink(req.params.id);
      await this._assertInternalEngagementAccess(link.engagementId, req.user!);
      res.json(buildResponse(await this.imocService.refreshLink(req.params.id, req.user!), 'IMOC ticket refreshed'));
    } catch (err) { next(err); }
  }

  /** @route POST /integration/imoc/tickets/:id/capture @desc Capture redacted IMOC ticket snapshot as evidence @access imoc:capture */
  private async _capture(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.imocService.getLink(req.params.id);
      await this._assertInternalEngagementAccess(link.engagementId, req.user!);
      res.status(201).json(buildResponse(await this.imocService.captureSnapshot(req.params.id, req.user!), 'IMOC ticket snapshot captured as audit evidence'));
    } catch (err) { next(err); }
  }

  /** @route GET /integration/imoc/tickets/:id/snapshots @desc List captured IMOC audit snapshots @access imoc:read */
  private async _snapshots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.imocService.getLink(req.params.id);
      await this._assertInternalEngagementAccess(link.engagementId, req.user!);
      res.json(buildResponse(await this.imocService.listSnapshots(req.params.id, req.user!)));
    } catch (err) { next(err); }
  }

  private async _assertInternalEngagementAccess(engagementId: string, actor: NonNullable<Request['user']>): Promise<void> {
    const engagement = await this.engagementService.getEngagementById(engagementId, actor);
    if (engagement.viewerContext?.role === 'auditee') {
      throw AppError.forbidden('Auditees cannot access internally linked IMOC ticket data.');
    }
  }
}
