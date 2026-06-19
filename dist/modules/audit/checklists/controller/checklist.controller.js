"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const checklist_request_dto_1 = require("../dto/request/checklist.request.dto");
class ChecklistController {
    checklistService;
    router;
    constructor(checklistService) {
        this.checklistService = checklistService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /audit/checklist-templates
         * @desc   Get the per-audit-type checklist control templates
         * @access Private - settings:read
         */
        this.router.get('/checklist-templates', (0, auth_middleware_1.requirePermission)('settings:read'), this._getChecklistTemplates.bind(this));
        /**
         * @route  GET /audit/checklist-controls/:auditType
         * @desc   Preview the control set that would populate an engagement of this
         *         audit type — used by the create-engagement wizard to pre-fill the
         *         customisable per-engagement checklist.
         * @access Private - engagement:create
         */
        this.router.get('/checklist-controls/:auditType', (0, auth_middleware_1.requirePermission)('engagement:create'), this._previewChecklistControls.bind(this));
        /**
         * @route  PUT /audit/checklist-templates
         * @desc   Replace the per-audit-type checklist control templates
         * @access Private - settings:manage
         */
        this.router.put('/checklist-templates', (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(checklist_request_dto_1.UpdateChecklistTemplatesRequestSchema), this._updateChecklistTemplates.bind(this));
        /**
         * @route  GET /audit/engagements/:id/checklists
         * @desc   Get engagement checklists
         * @access Private - audit:read
         */
        this.router.get('/engagements/:id/checklists', (0, auth_middleware_1.requirePermission)('checklist:read'), this._getChecklists.bind(this));
        /**
         * @route  POST /audit/engagements/:id/checklists
         * @desc   Add a custom checklist item to an engagement
         * @access Private - checklist:create
         */
        this.router.post('/engagements/:id/checklists', (0, auth_middleware_1.requirePermission)('checklist:create'), (0, validate_middleware_1.validate)(checklist_request_dto_1.CreateChecklistItemRequestSchema), this._createChecklistItem.bind(this));
        /**
         * @route  GET /audit/engagements/:id/checklists/progress
         * @desc   Get checklist progress
         * @access Private - audit:read
         */
        this.router.get('/engagements/:id/checklists/progress', (0, auth_middleware_1.requirePermission)('checklist:read'), this._getChecklistProgress.bind(this));
        /**
         * @route  PATCH /audit/checklists/:id
         * @desc   Update checklist item
         * @access Private - audit:write
         */
        this.router.patch('/checklists/:id', (0, auth_middleware_1.requirePermission)('checklist:update'), (0, validate_middleware_1.validate)(checklist_request_dto_1.UpdateChecklistItemRequestSchema), this._updateChecklistItem.bind(this));
        /**
         * @route  POST /audit/checklists/:id/evidence/:evidenceId
         * @desc   Link evidence to checklist item
         * @access Private - audit:write
         */
        this.router.post('/checklists/:id/evidence/:evidenceId', (0, auth_middleware_1.requirePermission)('checklist:update'), this._linkEvidenceToChecklistItem.bind(this));
    }
    async _getChecklistTemplates(_req, res, next) {
        try {
            const templates = await this.checklistService.getChecklistTemplates();
            res.status(200).json((0, api_response_type_1.buildResponse)(templates));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateChecklistTemplates(req, res, next) {
        try {
            const templates = await this.checklistService.updateChecklistTemplates(req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(templates, 'Checklist templates updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _previewChecklistControls(req, res, next) {
        try {
            const controls = await this.checklistService.previewControlsForAuditType(req.params.auditType);
            res.status(200).json((0, api_response_type_1.buildResponse)(controls));
        }
        catch (err) {
            next(err);
        }
    }
    async _getChecklists(req, res, next) {
        try {
            const checklists = await this.checklistService.getChecklists(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(checklists));
        }
        catch (err) {
            next(err);
        }
    }
    async _getChecklistProgress(req, res, next) {
        try {
            const progress = await this.checklistService.getChecklistProgress(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(progress));
        }
        catch (err) {
            next(err);
        }
    }
    async _createChecklistItem(req, res, next) {
        try {
            const item = await this.checklistService.createChecklistItem(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(item, 'Checklist item added'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateChecklistItem(req, res, next) {
        try {
            const item = await this.checklistService.updateChecklistItem(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(item, 'Checklist item updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkEvidenceToChecklistItem(req, res, next) {
        try {
            const item = await this.checklistService.linkEvidenceToChecklistItem(req.params.id, req.params.evidenceId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(item, 'Evidence linked to checklist item'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ChecklistController = ChecklistController;
//# sourceMappingURL=checklist.controller.js.map