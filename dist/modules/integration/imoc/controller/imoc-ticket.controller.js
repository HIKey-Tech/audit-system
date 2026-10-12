"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImocTicketController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const imoc_ingestion_service_1 = require("../service/implementation/imoc-ingestion.service");
const imoc_store_service_1 = require("../service/implementation/imoc-store.service");
const imoc_request_dto_1 = require("../dto/request/imoc.request.dto");
/** HTTP boundary for IMOC integration: ticket search, linking, ingestion rules, local store, saved views, and risk links. */
class ImocTicketController {
    imocService;
    engagementService;
    ingestionService;
    storeService;
    router = (0, express_1.Router)();
    constructor(imocService, engagementService, ingestionService = imoc_ingestion_service_1.imocIngestionService, storeService = imoc_store_service_1.imocStoreService) {
        this.imocService = imocService;
        this.engagementService = engagementService;
        this.ingestionService = ingestionService;
        this.storeService = storeService;
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        // Status & Diagnostics
        this.router.get('/status', (0, auth_middleware_1.requirePermission)('integration:read'), this._status.bind(this));
        this.router.get('/status/check', (0, auth_middleware_1.requirePermission)('integration:read'), this._checkStatus.bind(this));
        this.router.post('/status/check', (0, auth_middleware_1.requirePermission)('integration:read'), this._checkStatus.bind(this));
        // Live search & lookup
        this.router.post('/tickets/search', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.SearchImocTicketsSchema), this._search.bind(this));
        this.router.post('/tickets/detail', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ImocTicketLookupRequestSchema), this._detail.bind(this));
        this.router.post('/models/detail', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ImocModelLookupSchema), this._model.bind(this));
        this.router.post('/sync', (0, auth_middleware_1.requirePermission)('imoc:sync'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ImocSyncRequestSchema), this._sync.bind(this));
        // Ingestion Rules
        this.router.get('/rules', (0, auth_middleware_1.requirePermission)('imoc:rules'), this._listRules.bind(this));
        this.router.post('/rules', (0, auth_middleware_1.requirePermission)('imoc:rules'), (0, validate_middleware_1.validate)(imoc_request_dto_1.CreateImocRuleSchema), this._createRule.bind(this));
        this.router.get('/rules/:id', (0, auth_middleware_1.requirePermission)('imoc:rules'), this._getRule.bind(this));
        this.router.put('/rules/:id', (0, auth_middleware_1.requirePermission)('imoc:rules'), (0, validate_middleware_1.validate)(imoc_request_dto_1.UpdateImocRuleSchema), this._updateRule.bind(this));
        this.router.post('/rules/:id/toggle', (0, auth_middleware_1.requirePermission)('imoc:rules'), this._toggleRule.bind(this));
        this.router.delete('/rules/:id', (0, auth_middleware_1.requirePermission)('imoc:rules'), this._deleteRule.bind(this));
        this.router.post('/rules/preview', (0, auth_middleware_1.requirePermission)('imoc:rules'), (0, validate_middleware_1.validate)(imoc_request_dto_1.PreviewImocRuleSchema), this._previewRule.bind(this));
        // Ingestion Runs
        this.router.post('/ingestion/run', (0, auth_middleware_1.requirePermission)('imoc:ingest'), this._runIngestion.bind(this));
        this.router.get('/ingestion/runs', (0, auth_middleware_1.requirePermission)('imoc:rules'), this._listRuns.bind(this));
        this.router.get('/ingestion/runs/:id', (0, auth_middleware_1.requirePermission)('imoc:rules'), this._getRun.bind(this));
        // Stored Tickets (Local Store)
        this.router.get('/store/tickets', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ListStoredTicketsQuerySchema, 'query'), this._listStoredTickets.bind(this));
        this.router.get('/store/summary', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ListStoredTicketsQuerySchema.partial(), 'query'), this._storedSummary.bind(this));
        this.router.get('/store/export', (0, auth_middleware_1.requirePermission)('imoc:export'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ListStoredTicketsQuerySchema.partial(), 'query'), this._exportStoredTickets.bind(this));
        this.router.get('/store/tickets/:id', (0, auth_middleware_1.requirePermission)('imoc:read'), this._getStoredTicket.bind(this));
        // Saved Views (P3)
        this.router.get('/views', (0, auth_middleware_1.requirePermission)('imoc:read'), this._listViews.bind(this));
        this.router.post('/views', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.CreateSavedViewSchema), this._createView.bind(this));
        this.router.put('/views/:id', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.UpdateSavedViewSchema), this._updateView.bind(this));
        this.router.delete('/views/:id', (0, auth_middleware_1.requirePermission)('imoc:read'), this._deleteView.bind(this));
        // Risk Links (P3)
        this.router.post('/tickets/risk-link', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, auth_middleware_1.requirePermission)('risk:create'), (0, validate_middleware_1.validate)(imoc_request_dto_1.CreateTicketRiskLinkSchema), this._linkRisk.bind(this));
        this.router.delete('/tickets/:ticketId/risk-link/:riskId', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, auth_middleware_1.requirePermission)('risk:create'), this._unlinkRisk.bind(this));
        // Engagement Links & Snapshots (Audit Fieldwork)
        this.router.get('/engagements/:id/tickets', (0, auth_middleware_1.requirePermission)('imoc:read'), this._listLinks.bind(this));
        this.router.post('/engagements/:id/tickets', (0, auth_middleware_1.requirePermission)('imoc:link'), (0, validate_middleware_1.validate)(imoc_request_dto_1.LinkImocTicketSchema), this._link.bind(this));
        this.router.delete('/tickets/:id', (0, auth_middleware_1.requirePermission)('imoc:link'), this._unlink.bind(this));
        this.router.post('/tickets/:id/refresh', (0, auth_middleware_1.requirePermission)('imoc:sync'), this._refresh.bind(this));
        this.router.post('/tickets/:id/capture', (0, auth_middleware_1.requirePermission)('imoc:capture'), this._capture.bind(this));
        this.router.get('/tickets/:id/snapshots', (0, auth_middleware_1.requirePermission)('imoc:read'), this._snapshots.bind(this));
    }
    // -------------------------------------------------------------------------
    // Status
    // -------------------------------------------------------------------------
    async _status(_req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.getStatus()));
        }
        catch (err) {
            next(err);
        }
    }
    async _checkStatus(_req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.checkStatus()));
        }
        catch (err) {
            next(err);
        }
    }
    // -------------------------------------------------------------------------
    // Live Ticket Operations
    // -------------------------------------------------------------------------
    async _search(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.searchTickets(req.body, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    async _detail(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.getTicket(req.body, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    async _model(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.getModel(req.body.modelId, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    async _sync(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.syncActiveLinks(req.body.limit), 'IMOC linked-ticket refresh complete'));
        }
        catch (err) {
            next(err);
        }
    }
    // -------------------------------------------------------------------------
    // Ingestion Rules
    // -------------------------------------------------------------------------
    async _listRules(_req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.ingestionService.listRules()));
        }
        catch (err) {
            next(err);
        }
    }
    async _createRule(req, res, next) {
        try {
            const created = await this.ingestionService.createRule(req.user.id, req.body);
            res.status(201).json((0, api_response_type_1.buildResponse)(created, 'Ingestion rule created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRule(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.ingestionService.getRule(req.params.id)));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateRule(req, res, next) {
        try {
            const updated = await this.ingestionService.updateRule(req.user.id, req.params.id, req.body);
            res.json((0, api_response_type_1.buildResponse)(updated, 'Ingestion rule updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _toggleRule(req, res, next) {
        try {
            const toggled = await this.ingestionService.toggleRule(req.user.id, req.params.id);
            res.json((0, api_response_type_1.buildResponse)(toggled, `Ingestion rule ${toggled.isActive ? 'activated' : 'deactivated'}`));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteRule(req, res, next) {
        try {
            await this.ingestionService.deleteRule(req.user.id, req.params.id);
            res.json((0, api_response_type_1.buildResponse)(null, 'Ingestion rule deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _previewRule(req, res, next) {
        try {
            const result = await this.ingestionService.previewRule(req.body.criteria, req.body.lookbackDays);
            res.json((0, api_response_type_1.buildResponse)(result));
        }
        catch (err) {
            next(err);
        }
    }
    // -------------------------------------------------------------------------
    // Ingestion Runs
    // -------------------------------------------------------------------------
    async _runIngestion(req, res, next) {
        try {
            const summary = await this.ingestionService.runIngestion('manual', req.user.id);
            res.json((0, api_response_type_1.buildResponse)(summary, 'Ingestion run completed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listRuns(req, res, next) {
        try {
            const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
            const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;
            res.json((0, api_response_type_1.buildResponse)(await this.ingestionService.listRuns(page, pageSize)));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRun(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.ingestionService.getRun(req.params.id)));
        }
        catch (err) {
            next(err);
        }
    }
    // -------------------------------------------------------------------------
    // Local Store (Browse, Summary, Export)
    // -------------------------------------------------------------------------
    async _listStoredTickets(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.storeService.listStoredTickets(req.query)));
        }
        catch (err) {
            next(err);
        }
    }
    async _storedSummary(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.storeService.getStoredSummary(req.query)));
        }
        catch (err) {
            next(err);
        }
    }
    async _getStoredTicket(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.storeService.getStoredTicket(req.params.id)));
        }
        catch (err) {
            next(err);
        }
    }
    async _exportStoredTickets(req, res, next) {
        try {
            const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
            const file = await this.storeService.exportStoredTickets(req.query, format);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
            res.send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
    // -------------------------------------------------------------------------
    // Saved Views (P3)
    // -------------------------------------------------------------------------
    async _listViews(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.storeService.listSavedViews(req.user.id)));
        }
        catch (err) {
            next(err);
        }
    }
    async _createView(req, res, next) {
        try {
            const view = await this.storeService.createSavedView(req.user.id, req.body);
            res.status(201).json((0, api_response_type_1.buildResponse)(view, 'Saved view created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateView(req, res, next) {
        try {
            const view = await this.storeService.updateSavedView(req.user.id, req.params.id, req.body);
            res.json((0, api_response_type_1.buildResponse)(view, 'Saved view updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteView(req, res, next) {
        try {
            await this.storeService.deleteSavedView(req.user.id, req.params.id);
            res.json((0, api_response_type_1.buildResponse)(null, 'Saved view deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    // -------------------------------------------------------------------------
    // Risk Links (P3)
    // -------------------------------------------------------------------------
    async _linkRisk(req, res, next) {
        try {
            const link = await this.storeService.linkTicketToRisk(req.user, req.body);
            res.status(201).json((0, api_response_type_1.buildResponse)(link, 'Risk linked to ticket'));
        }
        catch (err) {
            next(err);
        }
    }
    async _unlinkRisk(req, res, next) {
        try {
            await this.storeService.unlinkTicketRisk(req.user.id, req.params.ticketId, req.params.riskId);
            res.json((0, api_response_type_1.buildResponse)(null, 'Risk unlinked from ticket'));
        }
        catch (err) {
            next(err);
        }
    }
    // -------------------------------------------------------------------------
    // Engagement Links & Snapshots (Audit Fieldwork)
    // -------------------------------------------------------------------------
    async _listLinks(req, res, next) {
        try {
            await this._assertInternalEngagementAccess(req.params.id, req.user);
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.listLinks(req.params.id, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    async _link(req, res, next) {
        try {
            await this._assertInternalEngagementAccess(req.params.id, req.user);
            const link = await this.imocService.linkTicket(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(link, 'IMOC ticket linked to engagement'));
        }
        catch (err) {
            next(err);
        }
    }
    async _unlink(req, res, next) {
        try {
            const link = await this.imocService.getLink(req.params.id);
            await this._assertInternalEngagementAccess(link.engagementId, req.user);
            await this.imocService.unlinkTicket(req.params.id, req.user);
            res.json((0, api_response_type_1.buildResponse)(null, 'IMOC ticket unlinked from engagement'));
        }
        catch (err) {
            next(err);
        }
    }
    async _refresh(req, res, next) {
        try {
            const link = await this.imocService.getLink(req.params.id);
            await this._assertInternalEngagementAccess(link.engagementId, req.user);
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.refreshLink(req.params.id, req.user), 'IMOC ticket refreshed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _capture(req, res, next) {
        try {
            const link = await this.imocService.getLink(req.params.id);
            await this._assertInternalEngagementAccess(link.engagementId, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(await this.imocService.captureSnapshot(req.params.id, req.user), 'IMOC ticket snapshot captured as audit evidence'));
        }
        catch (err) {
            next(err);
        }
    }
    async _snapshots(req, res, next) {
        try {
            const link = await this.imocService.getLink(req.params.id);
            await this._assertInternalEngagementAccess(link.engagementId, req.user);
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.listSnapshots(req.params.id, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    async _assertInternalEngagementAccess(engagementId, actor) {
        const engagement = await this.engagementService.getEngagementById(engagementId, actor);
        if (engagement.viewerContext?.role === 'auditee') {
            throw app_error_1.AppError.forbidden('Auditees cannot access internally linked IMOC ticket data.');
        }
    }
}
exports.ImocTicketController = ImocTicketController;
//# sourceMappingURL=imoc-ticket.controller.js.map