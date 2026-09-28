"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImocTicketController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const imoc_request_dto_1 = require("../dto/request/imoc.request.dto");
/** HTTP boundary for the optional, read-only IMOC ticket integration. */
class ImocTicketController {
    imocService;
    engagementService;
    router = (0, express_1.Router)();
    constructor(imocService, engagementService) {
        this.imocService = imocService;
        this.engagementService = engagementService;
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        this.router.get('/status', (0, auth_middleware_1.requirePermission)('integration:read'), this._status.bind(this));
        this.router.post('/tickets/search', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.SearchImocTicketsSchema), this._search.bind(this));
        this.router.post('/tickets/detail', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ImocTicketLookupRequestSchema), this._detail.bind(this));
        this.router.post('/models/detail', (0, auth_middleware_1.requirePermission)('imoc:read'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ImocModelLookupSchema), this._model.bind(this));
        this.router.post('/sync', (0, auth_middleware_1.requirePermission)('imoc:sync'), (0, validate_middleware_1.validate)(imoc_request_dto_1.ImocSyncRequestSchema), this._sync.bind(this));
        this.router.get('/engagements/:id/tickets', (0, auth_middleware_1.requirePermission)('imoc:read'), this._listLinks.bind(this));
        this.router.post('/engagements/:id/tickets', (0, auth_middleware_1.requirePermission)('imoc:link'), (0, validate_middleware_1.validate)(imoc_request_dto_1.LinkImocTicketSchema), this._link.bind(this));
        this.router.delete('/tickets/:id', (0, auth_middleware_1.requirePermission)('imoc:link'), this._unlink.bind(this));
        this.router.post('/tickets/:id/refresh', (0, auth_middleware_1.requirePermission)('imoc:sync'), this._refresh.bind(this));
        this.router.post('/tickets/:id/capture', (0, auth_middleware_1.requirePermission)('imoc:capture'), this._capture.bind(this));
        this.router.get('/tickets/:id/snapshots', (0, auth_middleware_1.requirePermission)('imoc:read'), this._snapshots.bind(this));
    }
    /** @route GET /integration/imoc/status @desc View non-secret IMOC availability @access integration:read */
    async _status(_req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.getStatus()));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route POST /integration/imoc/tickets/search @desc Search IMOC tickets read-only @access imoc:read */
    async _search(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.searchTickets(req.body, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route POST /integration/imoc/tickets/detail @desc Read one IMOC ticket @access imoc:read */
    async _detail(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.getTicket(req.body, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route POST /integration/imoc/models/detail @desc Read safe IMOC model metadata @access imoc:read */
    async _model(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.getModel(req.body.modelId, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route POST /integration/imoc/sync @desc Refresh a small batch of already-linked tickets @access imoc:sync */
    async _sync(req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.syncActiveLinks(req.body.limit), 'IMOC linked-ticket refresh complete'));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route GET /integration/imoc/engagements/:id/tickets @desc List engagement IMOC links @access imoc:read */
    async _listLinks(req, res, next) {
        try {
            await this._assertInternalEngagementAccess(req.params.id, req.user);
            res.json((0, api_response_type_1.buildResponse)(await this.imocService.listLinks(req.params.id, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route POST /integration/imoc/engagements/:id/tickets @desc Link an existing IMOC ticket @access imoc:link */
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
    /** @route DELETE /integration/imoc/tickets/:id @desc Remove an IMOC engagement link @access imoc:link */
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
    /** @route POST /integration/imoc/tickets/:id/refresh @desc Refresh one existing IMOC ticket link @access imoc:sync */
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
    /** @route POST /integration/imoc/tickets/:id/capture @desc Capture redacted IMOC ticket snapshot as evidence @access imoc:capture */
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
    /** @route GET /integration/imoc/tickets/:id/snapshots @desc List captured IMOC audit snapshots @access imoc:read */
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