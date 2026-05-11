"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkingPaperTemplateController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const app_error_1 = require("../../../shared/errors/app.error");
const settings_request_dto_1 = require("../dto/request/settings.request.dto");
const settings_enum_1 = require("../domain/enum/settings.enum");
class WorkingPaperTemplateController {
    templateService;
    router;
    constructor(templateService) {
        this.templateService = templateService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /settings/working-paper-templates
         * @desc   List working paper templates
         * @access Private - settings:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('settings:read'), (0, validate_middleware_1.validate)(settings_request_dto_1.WorkingPaperTemplateQuerySchema, 'query'), this._listTemplates.bind(this));
        /**
         * @route  GET /settings/working-paper-templates/default/:auditType
         * @desc   Get default working paper template for an audit type
         * @access Private - settings:read
         */
        this.router.get('/default/:auditType', (0, auth_middleware_1.requirePermission)('settings:read'), this._getDefaultTemplate.bind(this));
        /**
         * @route  GET /settings/working-paper-templates/:id
         * @desc   Get working paper template by ID
         * @access Private - settings:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('settings:read'), this._getTemplateById.bind(this));
        /**
         * @route  POST /settings/working-paper-templates
         * @desc   Create working paper template
         * @access Private - settings:manage
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(settings_request_dto_1.CreateWorkingPaperTemplateRequestSchema), this._createTemplate.bind(this));
        /**
         * @route  PUT /settings/working-paper-templates/:id
         * @desc   Update working paper template
         * @access Private - settings:manage
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(settings_request_dto_1.UpdateWorkingPaperTemplateRequestSchema), this._updateTemplate.bind(this));
        /**
         * @route  POST /settings/working-paper-templates/:id/set-default
         * @desc   Mark working paper template as default for its audit type
         * @access Private - settings:manage
         */
        this.router.post('/:id/set-default', (0, auth_middleware_1.requirePermission)('settings:manage'), this._setDefaultTemplate.bind(this));
        /**
         * @route  DELETE /settings/working-paper-templates/:id
         * @desc   Deactivate working paper template
         * @access Private - settings:manage
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('settings:manage'), this._deactivateTemplate.bind(this));
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
    async _getDefaultTemplate(req, res, next) {
        try {
            const auditType = req.params.auditType;
            if (!settings_enum_1.SETTINGS_AUDIT_TYPES.includes(auditType)) {
                throw app_error_1.AppError.badRequest('Invalid audit type');
            }
            const template = await this.templateService.getDefaultTemplate(auditType);
            res.status(200).json((0, api_response_type_1.buildResponse)(template));
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
            res.status(201).json((0, api_response_type_1.buildResponse)(template, 'Working paper template created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateTemplate(req, res, next) {
        try {
            const template = await this.templateService.updateTemplate(req.params.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(template, 'Working paper template updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _setDefaultTemplate(req, res, next) {
        try {
            const template = await this.templateService.setDefaultTemplate(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(template, 'Default working paper template updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deactivateTemplate(req, res, next) {
        try {
            await this.templateService.deactivateTemplate(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Working paper template deactivated'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.WorkingPaperTemplateController = WorkingPaperTemplateController;
//# sourceMappingURL=working-paper-template.controller.js.map