"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoryMappingController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const directory_request_dto_1 = require("../dto/request/directory.request.dto");
const directory_response_dto_1 = require("../dto/response/directory.response.dto");
class DirectoryMappingController {
    service;
    router = (0, express_1.Router)();
    constructor(service) {
        this.service = service;
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.get('/mappings', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermission)('settings:read'), this._list.bind(this));
        this.router.post('/mappings', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(directory_request_dto_1.CreateMappingSchema), this._create.bind(this));
        this.router.patch('/mappings/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(directory_request_dto_1.UpdateMappingSchema), this._update.bind(this));
        this.router.delete('/mappings/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermission)('settings:manage'), this._delete.bind(this));
        this.router.post('/sync', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermission)('settings:manage'), this._sync.bind(this));
    }
    /** @route GET /integration/directory/mappings @desc List group→role mappings @access settings:read */
    async _list(_req, res, next) {
        try {
            const rows = await this.service.listMappings();
            res.json((0, api_response_type_1.buildResponse)(rows.map(directory_response_dto_1.mapMappingToResponse), 'Directory mappings retrieved'));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route POST /integration/directory/mappings @desc Create a mapping @access settings:manage */
    async _create(req, res, next) {
        try {
            const m = await this.service.createMapping(req.body, req.user.id);
            res.status(201).json((0, api_response_type_1.buildResponse)((0, directory_response_dto_1.mapMappingToResponse)(m), 'Mapping created'));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route PATCH /integration/directory/mappings/:id @desc Update a mapping @access settings:manage */
    async _update(req, res, next) {
        try {
            const m = await this.service.updateMapping(req.params.id, req.body, req.user.id);
            res.json((0, api_response_type_1.buildResponse)((0, directory_response_dto_1.mapMappingToResponse)(m), 'Mapping updated'));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route DELETE /integration/directory/mappings/:id @desc Delete a mapping @access settings:manage */
    async _delete(req, res, next) {
        try {
            await this.service.deleteMapping(req.params.id, req.user.id);
            res.json((0, api_response_type_1.buildResponse)(null, 'Mapping deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    /** @route POST /integration/directory/sync @desc Trigger a full directory sync @access settings:manage */
    async _sync(_req, res, next) {
        try {
            const result = await this.service.runFullDirectorySync();
            res.json((0, api_response_type_1.buildResponse)(result, 'Directory sync complete'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DirectoryMappingController = DirectoryMappingController;
//# sourceMappingURL=directory-mapping.controller.js.map