"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateController = void 0;
// src/modules/messaging/controller/template.controller.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const template_request_dto_1 = require("../dto/request/template.request.dto");
class TemplateController {
    templateService;
    router;
    constructor(templateService) {
        this.templateService = templateService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        // All template routes require authentication
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /notifications/templates
         * @desc   List notification templates (paginated, filterable by channel/eventKey/isActive)
         * @access Private — notification:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('notification_template:read'), (0, validate_middleware_1.validate)(template_request_dto_1.TemplateQuerySchema, 'query'), this._listTemplates.bind(this));
        /**
         * @route  POST /notifications/templates
         * @desc   Create a notification template
         * @access Private — audit:admin
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('notification_template:write'), (0, validate_middleware_1.validate)(template_request_dto_1.CreateTemplateRequestSchema), this._createTemplate.bind(this));
        /**
         * @route  GET /notifications/templates/:id
         * @desc   Get a notification template by ID
         * @access Private — notification:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('notification_template:read'), this._getTemplateById.bind(this));
        /**
         * @route  PATCH /notifications/templates/:id
         * @desc   Update a notification template
         * @access Private — audit:admin
         */
        this.router.patch('/:id', (0, auth_middleware_1.requirePermission)('notification_template:write'), (0, validate_middleware_1.validate)(template_request_dto_1.UpdateTemplateRequestSchema), this._updateTemplate.bind(this));
        /**
         * @route  DELETE /notifications/templates/:id
         * @desc   Deactivate (soft-delete) a notification template
         * @access Private — audit:admin
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('notification_template:delete'), this._deactivateTemplate.bind(this));
    }
    async _listTemplates(req, res, next) {
        try {
            const { templates, meta } = await this.templateService.listTemplates(req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(templates, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _getTemplateById(req, res, next) {
        try {
            const template = await this.templateService.getTemplateById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(template));
        }
        catch (err) {
            next(err);
        }
    }
    async _createTemplate(req, res, next) {
        try {
            const template = await this.templateService.createTemplate(req.body, req.user.id);
            res.status(201).json((0, api_response_type_1.buildResponse)(template, 'Notification template created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateTemplate(req, res, next) {
        try {
            const template = await this.templateService.updateTemplate(req.params.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(template, 'Notification template updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deactivateTemplate(req, res, next) {
        try {
            await this.templateService.deactivateTemplate(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Notification template deactivated'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.TemplateController = TemplateController;
//# sourceMappingURL=template.controller.js.map