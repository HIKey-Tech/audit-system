"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemConfigController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const settings_request_dto_1 = require("../dto/request/settings.request.dto");
class SystemConfigController {
    configService;
    router;
    constructor(configService) {
        this.configService = configService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /settings/config
         * @desc   List all system configuration keys
         * @access Private - settings:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('settings:read'), this._getAllConfig.bind(this));
        /**
         * @route  GET /settings/config/public
         * @desc   List public system configuration keys
         * @access Private - authenticated
         */
        this.router.get('/public', this._getPublicConfig.bind(this));
        /**
         * @route  POST /settings/config/bulk-update
         * @desc   Update multiple system configuration keys
         * @access Private - settings:manage
         */
        this.router.post('/bulk-update', (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(settings_request_dto_1.BulkUpdateSystemConfigRequestSchema), this._bulkUpdateConfig.bind(this));
        /**
         * @route  GET /settings/config/:key
         * @desc   Get one system configuration key
         * @access Private - settings:read
         */
        this.router.get('/:key', (0, auth_middleware_1.requirePermission)('settings:read'), this._getConfig.bind(this));
        /**
         * @route  PUT /settings/config/:key
         * @desc   Update one system configuration key
         * @access Private - settings:manage
         */
        this.router.put('/:key', (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(settings_request_dto_1.UpdateSystemConfigRequestSchema), this._updateConfig.bind(this));
    }
    async _getAllConfig(_req, res, next) {
        try {
            const configs = await this.configService.getAllConfig(true);
            res.status(200).json((0, api_response_type_1.buildResponse)(configs));
        }
        catch (err) {
            next(err);
        }
    }
    async _getPublicConfig(_req, res, next) {
        try {
            const configs = await this.configService.getAllConfig(false);
            res.status(200).json((0, api_response_type_1.buildResponse)(configs));
        }
        catch (err) {
            next(err);
        }
    }
    async _getConfig(req, res, next) {
        try {
            const config = await this.configService.getConfig(req.params.key);
            res.status(200).json((0, api_response_type_1.buildResponse)(config));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateConfig(req, res, next) {
        try {
            const config = await this.configService.updateConfig(req.params.key, req.body.value, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(config, 'System config updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _bulkUpdateConfig(req, res, next) {
        try {
            const configs = await this.configService.bulkUpdateConfig(req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(configs, 'System config updated'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SystemConfigController = SystemConfigController;
//# sourceMappingURL=system-config.controller.js.map