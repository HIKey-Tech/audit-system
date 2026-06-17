"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportTemplateController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const settings_request_dto_1 = require("../dto/request/settings.request.dto");
class ReportTemplateController {
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
         * @route  GET /settings/report-templates
         * @desc   List report templates
         * @access Private - settings:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('settings:read'), (0, validate_middleware_1.validate)(settings_request_dto_1.ReportTemplateQuerySchema, 'query'), this._listTemplates.bind(this));
        /**
         * @route  GET /settings/report-templates/default
         * @desc   Get default report template
         * @access Private - settings:read
         */
        this.router.get('/default', (0, auth_middleware_1.requirePermission)('settings:read'), this._getDefaultTemplate.bind(this));
        /**
         * @route  GET /settings/report-templates/variables
         * @desc   Get variables available in the default report template
         * @access Private - settings:read
         */
        this.router.get('/variables', (0, auth_middleware_1.requirePermission)('settings:read'), this._getAvailableVariables.bind(this));
        /**
         * @route  GET /settings/report-templates/:id
         * @desc   Get report template by ID
         * @access Private - settings:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('settings:read'), this._getTemplateById.bind(this));
        /**
         * @route  POST /settings/report-templates
         * @desc   Create report template
         * @access Private - settings:manage
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('report_template:manage'), (0, validate_middleware_1.validate)(settings_request_dto_1.CreateReportTemplateRequestSchema), this._createTemplate.bind(this));
        /**
         * @route  PUT /settings/report-templates/:id
         * @desc   Update report template
         * @access Private - settings:manage
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('report_template:manage'), (0, validate_middleware_1.validate)(settings_request_dto_1.UpdateReportTemplateRequestSchema), this._updateTemplate.bind(this));
        /**
         * @route  POST /settings/report-templates/:id/set-default
         * @desc   Mark report template as system default
         * @access Private - settings:manage
         */
        this.router.post('/:id/set-default', (0, auth_middleware_1.requirePermission)('report_template:manage'), this._setDefaultTemplate.bind(this));
        /**
         * @route  DELETE /settings/report-templates/:id
         * @desc   Deactivate report template
         * @access Private - settings:manage
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('report_template:manage'), this._deactivateTemplate.bind(this));
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
    async _getDefaultTemplate(_req, res, next) {
        try {
            const template = await this.templateService.getDefaultTemplate();
            res.status(200).json((0, api_response_type_1.buildResponse)(template));
        }
        catch (err) {
            next(err);
        }
    }
    async _getAvailableVariables(_req, res, next) {
        try {
            const variables = await this.templateService.getAvailableVariables();
            res.status(200).json((0, api_response_type_1.buildResponse)(variables));
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
            res.status(201).json((0, api_response_type_1.buildResponse)(template, 'Report template created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateTemplate(req, res, next) {
        try {
            const template = await this.templateService.updateTemplate(req.params.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(template, 'Report template updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _setDefaultTemplate(req, res, next) {
        try {
            const template = await this.templateService.setDefaultTemplate(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(template, 'Default report template updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deactivateTemplate(req, res, next) {
        try {
            await this.templateService.deactivateTemplate(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Report template deactivated'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ReportTemplateController = ReportTemplateController;
//# sourceMappingURL=report-template.controller.js.map