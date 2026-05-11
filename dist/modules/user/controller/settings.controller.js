"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
// src/modules/user/controller/settings.controller.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const user_request_dto_1 = require("../dto/request/user.request.dto");
class SettingsController {
    userService;
    router;
    constructor(userService) {
        this.userService = userService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /settings/roles
         * @desc   List all roles with permissions
         * @access Private - settings:read
         */
        this.router.get('/roles', (0, auth_middleware_1.requirePermission)('settings:read'), this._listRoles.bind(this));
        /**
         * @route  GET /settings/roles/:id
         * @desc   Get a role by ID
         * @access Private - settings:read
         */
        this.router.get('/roles/:id', (0, auth_middleware_1.requirePermission)('settings:read'), this._getRoleById.bind(this));
        /**
         * @route  POST /settings/roles
         * @desc   Create a role
         * @access Private - settings:manage
         */
        this.router.post('/roles', (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(user_request_dto_1.CreateRoleRequestSchema), this._createRole.bind(this));
        /**
         * @route  PUT /settings/roles/:id
         * @desc   Update a role name or description
         * @access Private - settings:manage
         */
        this.router.put('/roles/:id', (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(user_request_dto_1.UpdateRoleRequestSchema), this._updateRole.bind(this));
        /**
         * @route  DELETE /settings/roles/:id
         * @desc   Delete a role if it is not system-owned or assigned
         * @access Private - settings:manage
         */
        this.router.delete('/roles/:id', (0, auth_middleware_1.requirePermission)('settings:manage'), this._deleteRole.bind(this));
        /**
         * @route  PUT /settings/roles/:id/permissions
         * @desc   Replace all permissions on a role
         * @access Private - settings:manage
         */
        this.router.put('/roles/:id/permissions', (0, auth_middleware_1.requirePermission)('settings:manage'), (0, validate_middleware_1.validate)(user_request_dto_1.ReplaceRolePermissionsRequestSchema), this._replaceRolePermissions.bind(this));
        /**
         * @route  GET /settings/permissions
         * @desc   List permissions grouped by module
         * @access Private - settings:read
         */
        this.router.get('/permissions', (0, auth_middleware_1.requirePermission)('settings:read'), this._listPermissionsGroupedByModule.bind(this));
    }
    async _listRoles(_req, res, next) {
        try {
            const { roles } = await this.userService.listRoles({
                page: 1,
                pageSize: 100,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            res.status(200).json((0, api_response_type_1.buildResponse)(roles));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRoleById(req, res, next) {
        try {
            const role = await this.userService.getRoleById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(role));
        }
        catch (err) {
            next(err);
        }
    }
    async _createRole(req, res, next) {
        try {
            const role = await this.userService.createRole(req.body, req.user.id);
            res.status(201).json((0, api_response_type_1.buildResponse)(role, 'Role created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateRole(req, res, next) {
        try {
            const role = await this.userService.updateRole(req.params.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(role, 'Role updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteRole(req, res, next) {
        try {
            await this.userService.deleteRole(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Role deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _replaceRolePermissions(req, res, next) {
        try {
            const role = await this.userService.replaceRolePermissions(req.params.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(role, 'Role permissions updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listPermissionsGroupedByModule(_req, res, next) {
        try {
            const permissions = await this.userService.listPermissionsGroupedByModule();
            res.status(200).json((0, api_response_type_1.buildResponse)(permissions));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SettingsController = SettingsController;
//# sourceMappingURL=settings.controller.js.map