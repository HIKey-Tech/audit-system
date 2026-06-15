"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaController = void 0;
// src/modules/user/controller/mfa.controller.ts
const express_1 = require("express");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const auth_request_dto_1 = require("../dto/request/auth.request.dto");
class MfaController {
    mfaService;
    authService;
    router;
    constructor(mfaService, authService) {
        this.mfaService = mfaService;
        this.authService = authService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        /**
         * @route  POST /auth/2fa/setup
         * @desc   Begin 2FA enrolment (TOTP QR or email OTP)
         * @access Enrolment token
         */
        this.router.post('/setup', auth_middleware_1.requireEnrollmentContext, (0, validate_middleware_1.validate)(auth_request_dto_1.MfaSetupRequestSchema), this._setup.bind(this));
        /**
         * @route  POST /auth/2fa/enroll
         * @desc   Verify enrolment code, enable 2FA, return backup codes + tokens
         * @access Enrolment token
         */
        this.router.post('/enroll', auth_middleware_1.requireEnrollmentContext, (0, validate_middleware_1.validate)(auth_request_dto_1.MfaEnrollRequestSchema), this._enroll.bind(this));
        /**
         * @route  POST /auth/2fa/verify
         * @desc   Verify a login 2FA code; issues the real token pair
         * @access Challenge token
         */
        this.router.post('/verify', (0, auth_middleware_1.requireMfaToken)('mfa_challenge'), (0, validate_middleware_1.validate)(auth_request_dto_1.MfaVerifyRequestSchema), this._verify.bind(this));
        /**
         * @route  POST /auth/2fa/backup-codes/regenerate
         * @desc   Regenerate backup codes for the authenticated user
         * @access Private
         */
        this.router.post('/backup-codes/regenerate', auth_middleware_1.authenticate, this._regenerateBackupCodes.bind(this));
        /**
         * @route  POST /auth/2fa/admin-reset
         * @desc   Reset a user's 2FA (lockout recovery)
         * @access user:reset_2fa
         */
        this.router.post('/admin-reset', auth_middleware_1.authenticate, (0, auth_middleware_1.requirePermission)('user:reset_2fa'), (0, validate_middleware_1.validate)(auth_request_dto_1.MfaAdminResetRequestSchema), this._adminReset.bind(this));
    }
    async _setup(req, res, next) {
        try {
            const { id, email } = req.mfaToken;
            const result = await this.mfaService.setup(id, email, req.body.method);
            res.status(200).json((0, api_response_type_1.buildResponse)(result, '2FA setup initiated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _enroll(req, res, next) {
        try {
            const { id } = req.mfaToken;
            const backupCodes = await this.mfaService.completeEnrollment(id, req.body.method, req.body.code);
            const auth = await this.authService.completeMfaLogin(id, req.ip, req.headers['user-agent']);
            res.status(200).json((0, api_response_type_1.buildResponse)({ backupCodes, auth }, '2FA enabled'));
        }
        catch (err) {
            next(err);
        }
    }
    async _verify(req, res, next) {
        try {
            const { id } = req.mfaToken;
            await this.mfaService.verifyChallenge(id, req.body.code);
            const auth = await this.authService.completeMfaLogin(id, req.ip, req.headers['user-agent']);
            res.status(200).json((0, api_response_type_1.buildResponse)(auth, 'Login successful'));
        }
        catch (err) {
            next(err);
        }
    }
    async _regenerateBackupCodes(req, res, next) {
        try {
            const backupCodes = await this.mfaService.regenerateBackupCodes(req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)({ backupCodes }, 'Backup codes regenerated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _adminReset(req, res, next) {
        try {
            await this.mfaService.adminReset(req.body.userId, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, "User's 2FA has been reset"));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.MfaController = MfaController;
//# sourceMappingURL=mfa.controller.js.map