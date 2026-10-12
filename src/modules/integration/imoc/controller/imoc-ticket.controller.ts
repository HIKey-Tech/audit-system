import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, requirePermission } from '../../../../shared/middleware/auth.middleware';
import { validate } from '../../../../shared/middleware/validate.middleware';
import { AppError } from '../../../../shared/errors/app.error';
import { buildResponse } from '../../../../shared/types/api-response.type';
import { IEngagementService } from '../../../audit/engagement/service/interface/engagement.service.interface';
import { IImocTicketService } from '../service/interface/imoc-ticket.service.interface';
import { IImocIngestionService } from '../service/interface/imoc-ingestion.service.interface';
import { imocIngestionService as defaultImocIngestionService } from '../service/implementation/imoc-ingestion.service';
import { IImocStoreService } from '../service/interface/imoc-store.service.interface';
import { imocStoreService as defaultImocStoreService } from '../service/implementation/imoc-store.service';
import {
  CreateImocRuleSchema,
  CreateSavedViewSchema,
  CreateTicketRiskLinkSchema,
  ImocModelLookupSchema,
  ImocSyncRequestSchema,
  ImocTicketLookupRequestSchema,
  LinkImocTicketSchema,
  ListStoredTicketsQuerySchema,
  PreviewImocRuleSchema,
  SearchImocTicketsSchema,
  UpdateImocRuleSchema,
  UpdateSavedViewSchema,
} from '../dto/request/imoc.request.dto';

/** HTTP boundary for IMOC integration: ticket search, linking, ingestion rules, local store, saved views, and risk links. */
export class ImocTicketController {
  public readonly router: Router = Router();

  constructor(
    private readonly imocService: IImocTicketService,
    private readonly engagementService: IEngagementService,
    private readonly ingestionService: IImocIngestionService = defaultImocIngestionService,
    private readonly storeService: IImocStoreService = defaultImocStoreService,
  ) {
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.use(authenticate);

    // Status & Diagnostics
    this.router.get('/status', requirePermission('integration:read'), this._status.bind(this));
    this.router.get('/status/check', requirePermission('integration:read'), this._checkStatus.bind(this));
    this.router.post('/status/check', requirePermission('integration:read'), this._checkStatus.bind(this));

    // Live search & lookup
    this.router.post('/tickets/search', requirePermission('imoc:read'), validate(SearchImocTicketsSchema), this._search.bind(this));
    this.router.post('/tickets/detail', requirePermission('imoc:read'), validate(ImocTicketLookupRequestSchema), this._detail.bind(this));
    this.router.post('/models/detail', requirePermission('imoc:read'), validate(ImocModelLookupSchema), this._model.bind(this));
    this.router.post('/sync', requirePermission('imoc:sync'), validate(ImocSyncRequestSchema), this._sync.bind(this));

    // Ingestion Rules
    this.router.get('/rules', requirePermission('imoc:rules'), this._listRules.bind(this));
    this.router.post('/rules', requirePermission('imoc:rules'), validate(CreateImocRuleSchema), this._createRule.bind(this));
    this.router.get('/rules/:id', requirePermission('imoc:rules'), this._getRule.bind(this));
    this.router.put('/rules/:id', requirePermission('imoc:rules'), validate(UpdateImocRuleSchema), this._updateRule.bind(this));
    this.router.post('/rules/:id/toggle', requirePermission('imoc:rules'), this._toggleRule.bind(this));
    this.router.delete('/rules/:id', requirePermission('imoc:rules'), this._deleteRule.bind(this));
    this.router.post('/rules/preview', requirePermission('imoc:rules'), validate(PreviewImocRuleSchema), this._previewRule.bind(this));

    // Ingestion Runs
    this.router.post('/ingestion/run', requirePermission('imoc:ingest'), this._runIngestion.bind(this));
    this.router.get('/ingestion/runs', requirePermission('imoc:rules'), this._listRuns.bind(this));
    this.router.get('/ingestion/runs/:id', requirePermission('imoc:rules'), this._getRun.bind(this));

    // Stored Tickets (Local Store)
    this.router.get('/store/tickets', requirePermission('imoc:read'), validate(ListStoredTicketsQuerySchema, 'query'), this._listStoredTickets.bind(this));
    this.router.get('/store/summary', requirePermission('imoc:read'), validate(ListStoredTicketsQuerySchema.partial(), 'query'), this._storedSummary.bind(this));
    this.router.get('/store/export', requirePermission('imoc:export'), validate(ListStoredTicketsQuerySchema.partial(), 'query'), this._exportStoredTickets.bind(this));
    this.router.get('/store/tickets/:id', requirePermission('imoc:read'), this._getStoredTicket.bind(this));

    // Saved Views (P3)
    this.router.get('/views', requirePermission('imoc:read'), this._listViews.bind(this));
    this.router.post('/views', requirePermission('imoc:read'), validate(CreateSavedViewSchema), this._createView.bind(this));
    this.router.put('/views/:id', requirePermission('imoc:read'), validate(UpdateSavedViewSchema), this._updateView.bind(this));
    this.router.delete('/views/:id', requirePermission('imoc:read'), this._deleteView.bind(this));

    // Risk Links (P3)
    this.router.post('/tickets/risk-link', requirePermission('imoc:read'), requirePermission('risk:create'), validate(CreateTicketRiskLinkSchema), this._linkRisk.bind(this));
    this.router.delete('/tickets/:ticketId/risk-link/:riskId', requirePermission('imoc:read'), requirePermission('risk:create'), this._unlinkRisk.bind(this));

    // Engagement Links & Snapshots (Audit Fieldwork)
    this.router.get('/engagements/:id/tickets', requirePermission('imoc:read'), this._listLinks.bind(this));
    this.router.post('/engagements/:id/tickets', requirePermission('imoc:link'), validate(LinkImocTicketSchema), this._link.bind(this));
    this.router.delete('/tickets/:id', requirePermission('imoc:link'), this._unlink.bind(this));
    this.router.post('/tickets/:id/refresh', requirePermission('imoc:sync'), this._refresh.bind(this));
    this.router.post('/tickets/:id/capture', requirePermission('imoc:capture'), this._capture.bind(this));
    this.router.get('/tickets/:id/snapshots', requirePermission('imoc:read'), this._snapshots.bind(this));
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  private async _status(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.getStatus()));
    } catch (err) { next(err); }
  }

  private async _checkStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.checkStatus()));
    } catch (err) { next(err); }
  }

  // -------------------------------------------------------------------------
  // Live Ticket Operations
  // -------------------------------------------------------------------------

  private async _search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.searchTickets(req.body, req.user!)));
    } catch (err) { next(err); }
  }

  private async _detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.getTicket(req.body, req.user!)));
    } catch (err) { next(err); }
  }

  private async _model(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.getModel(req.body.modelId, req.user!)));
    } catch (err) { next(err); }
  }

  private async _sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.imocService.syncActiveLinks(req.body.limit), 'IMOC linked-ticket refresh complete'));
    } catch (err) { next(err); }
  }

  // -------------------------------------------------------------------------
  // Ingestion Rules
  // -------------------------------------------------------------------------

  private async _listRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.ingestionService.listRules()));
    } catch (err) { next(err); }
  }

  private async _createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const created = await this.ingestionService.createRule(req.user!.id, req.body);
      res.status(201).json(buildResponse(created, 'Ingestion rule created'));
    } catch (err) { next(err); }
  }

  private async _getRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.ingestionService.getRule(req.params.id)));
    } catch (err) { next(err); }
  }

  private async _updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await this.ingestionService.updateRule(req.user!.id, req.params.id, req.body);
      res.json(buildResponse(updated, 'Ingestion rule updated'));
    } catch (err) { next(err); }
  }

  private async _toggleRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const toggled = await this.ingestionService.toggleRule(req.user!.id, req.params.id);
      res.json(buildResponse(toggled, `Ingestion rule ${toggled.isActive ? 'activated' : 'deactivated'}`));
    } catch (err) { next(err); }
  }

  private async _deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.ingestionService.deleteRule(req.user!.id, req.params.id);
      res.json(buildResponse(null, 'Ingestion rule deleted'));
    } catch (err) { next(err); }
  }

  private async _previewRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.ingestionService.previewRule(req.body.criteria, req.body.lookbackDays);
      res.json(buildResponse(result));
    } catch (err) { next(err); }
  }

  // -------------------------------------------------------------------------
  // Ingestion Runs
  // -------------------------------------------------------------------------

  private async _runIngestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await this.ingestionService.runIngestion('manual', req.user!.id);
      res.json(buildResponse(summary, 'Ingestion run completed'));
    } catch (err) { next(err); }
  }

  private async _listRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;
      res.json(buildResponse(await this.ingestionService.listRuns(page, pageSize)));
    } catch (err) { next(err); }
  }

  private async _getRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.ingestionService.getRun(req.params.id)));
    } catch (err) { next(err); }
  }

  // -------------------------------------------------------------------------
  // Local Store (Browse, Summary, Export)
  // -------------------------------------------------------------------------

  private async _listStoredTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.storeService.listStoredTickets(req.query as any)));
    } catch (err) { next(err); }
  }

  private async _storedSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.storeService.getStoredSummary(req.query as any)));
    } catch (err) { next(err); }
  }

  private async _getStoredTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.storeService.getStoredTicket(req.params.id)));
    } catch (err) { next(err); }
  }

  private async _exportStoredTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as any) === 'csv' ? 'csv' : 'xlsx';
      const file = await this.storeService.exportStoredTickets(req.query as any, format);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.send(file.buffer);
    } catch (err) { next(err); }
  }

  // -------------------------------------------------------------------------
  // Saved Views (P3)
  // -------------------------------------------------------------------------

  private async _listViews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(buildResponse(await this.storeService.listSavedViews(req.user!.id)));
    } catch (err) { next(err); }
  }

  private async _createView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const view = await this.storeService.createSavedView(req.user!.id, req.body);
      res.status(201).json(buildResponse(view, 'Saved view created'));
    } catch (err) { next(err); }
  }

  private async _updateView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const view = await this.storeService.updateSavedView(req.user!.id, req.params.id, req.body);
      res.json(buildResponse(view, 'Saved view updated'));
    } catch (err) { next(err); }
  }

  private async _deleteView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.storeService.deleteSavedView(req.user!.id, req.params.id);
      res.json(buildResponse(null, 'Saved view deleted'));
    } catch (err) { next(err); }
  }

  // -------------------------------------------------------------------------
  // Risk Links (P3)
  // -------------------------------------------------------------------------

  private async _linkRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.storeService.linkTicketToRisk(req.user!, req.body);
      res.status(201).json(buildResponse(link, 'Risk linked to ticket'));
    } catch (err) { next(err); }
  }

  private async _unlinkRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.storeService.unlinkTicketRisk(req.user!.id, req.params.ticketId, req.params.riskId);
      res.json(buildResponse(null, 'Risk unlinked from ticket'));
    } catch (err) { next(err); }
  }

  // -------------------------------------------------------------------------
  // Engagement Links & Snapshots (Audit Fieldwork)
  // -------------------------------------------------------------------------

  private async _listLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this._assertInternalEngagementAccess(req.params.id, req.user!);
      res.json(buildResponse(await this.imocService.listLinks(req.params.id, req.user!)));
    } catch (err) { next(err); }
  }

  private async _link(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this._assertInternalEngagementAccess(req.params.id, req.user!);
      const link = await this.imocService.linkTicket(req.params.id, req.body, req.user!);
      res.status(201).json(buildResponse(link, 'IMOC ticket linked to engagement'));
    } catch (err) { next(err); }
  }

  private async _unlink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.imocService.getLink(req.params.id);
      await this._assertInternalEngagementAccess(link.engagementId, req.user!);
      await this.imocService.unlinkTicket(req.params.id, req.user!);
      res.json(buildResponse(null, 'IMOC ticket unlinked from engagement'));
    } catch (err) { next(err); }
  }

  private async _refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.imocService.getLink(req.params.id);
      await this._assertInternalEngagementAccess(link.engagementId, req.user!);
      res.json(buildResponse(await this.imocService.refreshLink(req.params.id, req.user!), 'IMOC ticket refreshed'));
    } catch (err) { next(err); }
  }

  private async _capture(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await this.imocService.getLink(req.params.id);
      await this._assertInternalEngagementAccess(link.engagementId, req.user!);
      res.status(201).json(buildResponse(await this.imocService.captureSnapshot(req.params.id, req.user!), 'IMOC ticket snapshot captured as audit evidence'));
    } catch (err) { next(err); }
  }

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
