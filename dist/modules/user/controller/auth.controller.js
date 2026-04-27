"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
// src/modules/user/controller/auth.controller.ts
const express_1 = require("express");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const auth_request_dto_1 = require("../dto/request/auth.request.dto");
class AuthController {
    authService;
    router;
    constructor(authService) {
        this.authService = authService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        /**
         * @route  POST /auth/login
         * @desc   Authenticate with email + password
         * @access Public
         */
        this.router.post('/login', (0, validate_middleware_1.validate)(auth_request_dto_1.LoginRequestSchema), this._login.bind(this));
        /**
         * @route  GET /auth/sso
         * @desc   Initiate SSO — returns authorization URL
         * @access Public
         */
        this.router.get('/sso', this._ssoInitiate.bind(this));
        /**
         * @route  GET /auth/callback
         * @desc   OIDC callback — exchange code for tokens
         * @access Public
         */
        this.router.get('/callback', (0, validate_middleware_1.validate)(auth_request_dto_1.OidcCallbackRequestSchema, 'query'), this._ssoCallback.bind(this));
        /**
         * @route  POST /auth/refresh
         * @desc   Refresh access token
         * @access Public
         */
        this.router.post('/refresh', (0, validate_middleware_1.validate)(auth_request_dto_1.RefreshTokenRequestSchema), this._refresh.bind(this));
        /**
         * @route  POST /auth/logout
         * @desc   Revoke refresh token
         * @access Private
         */
        this.router.post('/logout', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(auth_request_dto_1.RefreshTokenRequestSchema), this._logout.bind(this));
        /**
         * @route  POST /auth/logout-all
         * @desc   Revoke all refresh tokens for the authenticated user
         * @access Private
         */
        this.router.post('/logout-all', auth_middleware_1.authenticate, this._logoutAll.bind(this));
    }
    async _login(req, res, next) {
        try {
            const result = await this.authService.login(req.body, req.ip, req.headers['user-agent']);
            res.status(200).json((0, api_response_type_1.buildResponse)(result, 'Login successful'));
        }
        catch (err) {
            next(err);
        }
    }
    async _ssoInitiate(_req, res, next) {
        try {
            const result = await this.authService.getSsoAuthorizationUrl();
            res.status(200).json((0, api_response_type_1.buildResponse)(result, 'SSO authorization URL generated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _ssoCallback(req, res, next) {
        try {
            const { code, state } = req.query;
            const result = await this.authService.handleOidcCallback(code, state, req.ip, req.headers['user-agent']);
            res.status(200).json((0, api_response_type_1.buildResponse)(result, 'SSO authentication successful'));
        }
        catch (err) {
            next(err);
        }
    }
    async _refresh(req, res, next) {
        try {
            const tokens = await this.authService.refreshToken(req.body, req.ip);
            res.status(200).json((0, api_response_type_1.buildResponse)(tokens, 'Token refreshed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _logout(req, res, next) {
        try {
            await this.authService.logout(req.body.refreshToken);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Logged out successfully'));
        }
        catch (err) {
            next(err);
        }
    }
    async _logoutAll(req, res, next) {
        try {
            await this.authService.logoutAll(req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Logged out from all devices'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map