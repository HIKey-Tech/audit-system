"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowUpController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const follow_up_request_dto_1 = require("../dto/request/follow-up.request.dto");
class FollowUpController {
    followUpService;
    router;
    constructor(followUpService) {
        this.followUpService = followUpService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/findings/:id/followup/response
         * @desc   Submit management response
         * @access Private - audit:write
         */
        this.router.post('/findings/:id/followup/response', (0, auth_middleware_1.requirePermission)('followup:respond'), (0, validate_middleware_1.validate)(follow_up_request_dto_1.ManagementResponseRequestSchema), this._submitManagementResponse.bind(this));
        /**
         * @route  POST /audit/findings/:id/followup/evidence
         * @desc   Submit remediation evidence
         * @access Private - audit:write
         */
        this.router.post('/findings/:id/followup/evidence', (0, auth_middleware_1.requirePermission)('followup:evidence'), (0, validate_middleware_1.validate)(follow_up_request_dto_1.RemediationEvidenceRequestSchema), this._submitRemediationEvidence.bind(this));
        /**
         * @route  POST /audit/findings/:id/followup/verify
         * @desc   Verify remediation
         * @access Private - audit:write
         */
        this.router.post('/findings/:id/followup/verify', (0, auth_middleware_1.requirePermission)('followup:verify'), (0, validate_middleware_1.validate)(follow_up_request_dto_1.VerifyRemediationRequestSchema), this._verifyRemediation.bind(this));
        /**
         * @route  GET /audit/findings/:id/followup
         * @desc   Get finding follow-up
         * @access Private - audit:read
         */
        this.router.get('/findings/:id/followup', (0, auth_middleware_1.requirePermission)('followup:read'), this._getFollowUp.bind(this));
        /**
         * @route  GET /audit/engagements/:id/followups
         * @desc   List pending follow-ups
         * @access Private - audit:read
         */
        this.router.get('/engagements/:id/followups', (0, auth_middleware_1.requirePermission)('followup:read'), this._listPendingFollowUps.bind(this));
    }
    async _submitManagementResponse(req, res, next) {
        try {
            const followUp = await this.followUpService.submitManagementResponse(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(followUp, 'Management response submitted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _submitRemediationEvidence(req, res, next) {
        try {
            const followUp = await this.followUpService.submitRemediationEvidence(req.params.id, req.body.evidenceId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(followUp, 'Remediation evidence submitted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _verifyRemediation(req, res, next) {
        try {
            const followUp = await this.followUpService.verifyRemediation(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(followUp, 'Remediation verification updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getFollowUp(req, res, next) {
        try {
            const followUp = await this.followUpService.getFollowUp(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(followUp));
        }
        catch (err) {
            next(err);
        }
    }
    async _listPendingFollowUps(req, res, next) {
        try {
            const followUps = await this.followUpService.listPendingFollowUps(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(followUps));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.FollowUpController = FollowUpController;
//# sourceMappingURL=follow-up.controller.js.map