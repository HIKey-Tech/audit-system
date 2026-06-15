"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
// src/modules/user/controller/user.controller.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const user_request_dto_1 = require("../dto/request/user.request.dto");
class UserController {
    userService;
    router;
    constructor(userService) {
        this.userService = userService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        // All user routes require authentication
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /users/me
         * @desc   Get own profile
         * @access Private
         */
        this.router.get('/me', this._getMe.bind(this));
        /**
         * @route  PATCH /users/me
         * @desc   Update own profile
         * @access Private
         */
        this.router.patch('/me', (0, validate_middleware_1.validate)(user_request_dto_1.UpdateUserRequestSchema), this._updateMe.bind(this));
        /**
         * @route  POST /users/me/change-password
         * @desc   Change own password
         * @access Private
         */
        this.router.post('/me/change-password', (0, validate_middleware_1.validate)(user_request_dto_1.ChangePasswordRequestSchema), this._changePassword.bind(this));
        /**
         * @route  GET /users
         * @desc   List all users (paginated)
         * @access Private — user:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('role:read'), (0, validate_middleware_1.validate)(user_request_dto_1.UserQuerySchema, 'query'), this._listUsers.bind(this));
        /**
         * @route  GET /users/roles
         * @desc   List all roles with permissions (paginated)
         * @access Private — user:read
         */
        this.router.get('/roles', (0, auth_middleware_1.requirePermission)('permission:read'), (0, validate_middleware_1.validate)(user_request_dto_1.RoleQuerySchema, 'query'), this._listRoles.bind(this));
        /**
         * @route  GET /users/permissions
         * @desc   List all permissions
         * @access Private — user:read
         */
        this.router.get('/permissions', (0, auth_middleware_1.requirePermission)('user:read'), this._listPermissions.bind(this));
        /**
         * @route  POST /users
         * @desc   Create a user
         * @access Private — user:write
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('user:create'), (0, validate_middleware_1.validate)(user_request_dto_1.CreateUserRequestSchema), this._createUser.bind(this));
        /**
         * @route  GET /users/:id
         * @desc   Get user by ID
         * @access Private — user:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('user:read'), this._getUserById.bind(this));
        /**
         * @route  PATCH /users/:id
         * @desc   Update user by ID
         * @access Private — user:write
         */
        this.router.patch('/:id', (0, auth_middleware_1.requirePermission)('user:update'), (0, validate_middleware_1.validate)(user_request_dto_1.UpdateUserRequestSchema), this._updateUser.bind(this));
        /**
         * @route  POST /users/:id/deactivate
         * @desc   Deactivate user
         * @access Private - super_admin + user:deactivate
         */
        this.router.post('/:id/deactivate', (0, auth_middleware_1.requirePermission)('user:deactivate'), this._deactivateUser.bind(this));
        /**
         * @route  POST /users/:id/activate
         * @desc   Activate user
         * @access Private - super_admin + user:deactivate
         */
        this.router.post('/:id/activate', (0, auth_middleware_1.requirePermission)('user:deactivate'), this._activateUser.bind(this));
        /**
         * @route  DELETE /users/:id
         * @desc   Soft-delete user
         * @access Private — user:delete
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('user:delete'), this._deleteUser.bind(this));
        /**
         * @route  PUT /users/:id/roles
         * @desc   Assign roles to user
         * @access Private — user:admin
         */
        this.router.put('/:id/roles', (0, auth_middleware_1.requirePermission)('role:assign'), (0, validate_middleware_1.validate)(user_request_dto_1.AssignRoleRequestSchema), this._assignRoles.bind(this));
        /**
         * @route  DELETE /users/:id/roles/:roleId
         * @desc   Remove role from user
         * @access Private — user:admin
         */
        this.router.delete('/:id/roles/:roleId', (0, auth_middleware_1.requirePermission)('role:assign'), this._removeRole.bind(this));
    }
    async _getMe(req, res, next) {
        try {
            const user = await this.userService.getUserById(req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(user));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateMe(req, res, next) {
        try {
            const user = await this.userService.updateUser(req.user.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(user, 'Profile updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _changePassword(req, res, next) {
        try {
            await this.userService.changePassword(req.user.id, req.body);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Password changed successfully'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listUsers(req, res, next) {
        try {
            const { users, meta } = await this.userService.listUsers(req.query);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(users), meta });
        }
        catch (err) {
            next(err);
        }
    }
    async _listRoles(req, res, next) {
        try {
            const { roles, meta } = await this.userService.listRoles(req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(roles, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _listPermissions(req, res, next) {
        try {
            const permissions = await this.userService.listPermissions();
            res.status(200).json((0, api_response_type_1.buildResponse)(permissions));
        }
        catch (err) {
            next(err);
        }
    }
    async _createUser(req, res, next) {
        try {
            const user = await this.userService.createUser(req.body, req.user.id);
            res.status(201).json((0, api_response_type_1.buildResponse)(user, 'User created successfully'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getUserById(req, res, next) {
        try {
            const user = await this.userService.getUserById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(user));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateUser(req, res, next) {
        try {
            const user = await this.userService.updateUser(req.params.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(user, 'User updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteUser(req, res, next) {
        try {
            await this.userService.deleteUser(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'User deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deactivateUser(req, res, next) {
        try {
            const user = await this.userService.setUserActiveStatus(req.params.id, false, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(user, 'User deactivated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _activateUser(req, res, next) {
        try {
            const user = await this.userService.setUserActiveStatus(req.params.id, true, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(user, 'User activated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _assignRoles(req, res, next) {
        try {
            const user = await this.userService.assignRoles(req.params.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(user, 'Roles assigned'));
        }
        catch (err) {
            next(err);
        }
    }
    async _removeRole(req, res, next) {
        try {
            const user = await this.userService.removeRole(req.params.id, req.params.roleId, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(user, 'Role removed'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.UserController = UserController;
//# sourceMappingURL=user.controller.js.map