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
         * @route  GET /audit/engagements/:id/checklists
         * @desc   Get engagement checklists
         * @access Private - audit:read
         */
        this.router.get('/engagements/:id/checklists', (0, auth_middleware_1.requirePermission)('audit:read'), this._getChecklists.bind(this));
        /**
         * @route  GET /audit/engagements/:id/checklists/progress
         * @desc   Get checklist progress
         * @access Private - audit:read
         */
        this.router.get('/engagements/:id/checklists/progress', (0, auth_middleware_1.requirePermission)('audit:read'), this._getChecklistProgress.bind(this));
        /**
         * @route  PATCH /audit/checklists/:id
         * @desc   Update checklist item
         * @access Private - audit:write
         */
        this.router.patch('/checklists/:id', (0, auth_middleware_1.requirePermission)('audit:write'), (0, validate_middleware_1.validate)(checklist_request_dto_1.UpdateChecklistItemRequestSchema), this._updateChecklistItem.bind(this));
        /**
         * @route  POST /audit/checklists/:id/evidence/:evidenceId
         * @desc   Link evidence to checklist item
         * @access Private - audit:write
         */
        this.router.post('/checklists/:id/evidence/:evidenceId', (0, auth_middleware_1.requirePermission)('audit:write'), this._linkEvidenceToChecklistItem.bind(this));
    }
    async _getChecklists(req, res, next) {
        try {
            const checklists = await this.checklistService.getChecklists(req.params.id);
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