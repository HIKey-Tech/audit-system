"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectPlusController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const app_error_1 = require("../../../../shared/errors/app.error");
const projectplus_request_dto_1 = require("../dto/request/projectplus.request.dto");
/** HTTP boundary for the optional, read-only Project Plus integration. GET routes only. */
class ProjectPlusController {
    service;
    linkService;
    engagementService;
    router = (0, express_1.Router)();
    constructor(service, linkService, engagementService) {
        this.service = service;
        this.linkService = linkService;
        this.engagementService = engagementService;
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        this.router.get('/status', (0, auth_middleware_1.requirePermission)('integration:read'), this._status.bind(this));
        this.router.get('/status/check', (0, auth_middleware_1.requirePermission)('integration:read'), this._checkStatus.bind(this));
        this.router.get('/entities', (0, auth_middleware_1.requirePermission)('projectplus:read'), (0, validate_middleware_1.validate)(projectplus_request_dto_1.ListProjectPlusEntitiesQuerySchema, 'query'), this._entities.bind(this));
        this.router.get('/document-types', (0, auth_middleware_1.requirePermission)('projectplus:read'), this._documentTypes.bind(this));
        // Optional engagement links
        this.router.get('/engagements/:id/entities', (0, auth_middleware_1.requirePermission)('projectplus:read'), this._listLinks.bind(this));
        this.router.post('/engagements/:id/entities', (0, auth_middleware_1.requirePermission)('projectplus:link'), (0, validate_middleware_1.validate)(projectplus_request_dto_1.LinkProjectPlusEntitySchema), this._link.bind(this));
        this.router.delete('/entity-links/:id', (0, auth_middleware_1.requirePermission)('projectplus:link'), this._unlink.bind(this));
    }
    /**
     * @route GET /integration/projectplus/status
     * @desc Whether Project Plus is enabled and configured (no network call)
     * @access integration:read
     */
    async _status(_req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(this.service.getStatus(), 'Project Plus status retrieved'));
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * @route GET /integration/projectplus/status/check
     * @desc Live reachability/authentication check against the gateway
     * @access integration:read
     */
    async _checkStatus(_req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.service.checkStatus(), 'Project Plus status checked'));
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * @route GET /integration/projectplus/entities?customerType=&search=&status=&page=&pageSize=
     * @desc Read-only lookup of Project Plus customers / vendors / clients
     * @access projectplus:read
     */
    async _entities(req, res, next) {
        try {
            const query = req.query;
            const result = await this.service.listEntities(query);
            const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
            res.json((0, api_response_type_1.buildResponse)(result.items, 'Project Plus entities retrieved', {
                page: result.page,
                pageSize: result.pageSize,
                total: result.total,
                totalPages,
                hasNext: result.page < totalPages,
                hasPrev: result.page > 1,
            }));
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * @route GET /integration/projectplus/document-types
     * @desc Contract document type reference list
     * @access projectplus:read
     */
    async _documentTypes(_req, res, next) {
        try {
            res.json((0, api_response_type_1.buildResponse)(await this.service.getContractDocumentTypes(), 'Document types retrieved'));
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * @route GET /integration/projectplus/engagements/:id/entities
     * @desc Project Plus entities linked to an engagement
     * @access projectplus:read
     */
    async _listLinks(req, res, next) {
        try {
            await this._assertInternalEngagementAccess(req.params.id, req.user);
            res.json((0, api_response_type_1.buildResponse)(await this.linkService.listLinks(req.params.id, req.user)));
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * @route POST /integration/projectplus/engagements/:id/entities
     * @desc Optionally link a Project Plus entity to an engagement
     * @access projectplus:link
     */
    async _link(req, res, next) {
        try {
            await this._assertInternalEngagementAccess(req.params.id, req.user);
            const link = await this.linkService.linkEntity(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(link, 'Project Plus entity linked to engagement'));
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * @route DELETE /integration/projectplus/entity-links/:id
     * @desc Remove an engagement link (Project Plus itself is untouched)
     * @access projectplus:link
     */
    async _unlink(req, res, next) {
        try {
            const link = await this.linkService.getLink(req.params.id);
            await this._assertInternalEngagementAccess(link.engagementId, req.user);
            await this.linkService.unlinkEntity(req.params.id, req.user);
            res.json((0, api_response_type_1.buildResponse)(null, 'Project Plus entity unlinked from engagement'));
        }
        catch (err) {
            next(err);
        }
    }
    async _assertInternalEngagementAccess(engagementId, actor) {
        const engagement = await this.engagementService.getEngagementById(engagementId, actor);
        if (engagement.viewerContext?.role === 'auditee') {
            throw app_error_1.AppError.forbidden('Auditees cannot access internally linked Project Plus data.');
        }
    }
}
exports.ProjectPlusController = ProjectPlusController;
//# sourceMappingURL=projectplus.controller.js.map