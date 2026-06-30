"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const escalation_request_dto_1 = require("../dto/request/escalation.request.dto");
class EscalationController {
    escalationService;
    router;
    constructor(escalationService) {
        this.escalationService = escalationService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /workflow/escalations/entity/:type/:id
         * @desc   Get escalation history for an entity
         * @access Private - audit:read
         */
        this.router.get('/escalations/entity/:type/:id', (0, auth_middleware_1.requirePermission)('escalation:read'), (0, validate_middleware_1.validate)(escalation_request_dto_1.EscalationEntityParamsSchema, 'params'), this._getEscalationHistory.bind(this));
        /**
         * @route  POST /workflow/escalations/:id/acknowledge
         * @desc   Acknowledge escalation
         * @access Private - audit:write
         */
        this.router.post('/escalations/:id/acknowledge', (0, auth_middleware_1.requirePermission)('escalation:acknowledge'), this._acknowledgeEscalation.bind(this));
        /**
         * @route  GET /workflow/escalation-policy
         * @desc   List all active escalation policies
         * @access Private - audit:read
         */
        this.router.get('/escalation-policy', (0, auth_middleware_1.requirePermission)('escalation_policy:read'), this._listEscalationPolicies.bind(this));
        /**
         * @route  POST /workflow/escalation-policy
         * @desc   Create or update escalation policy
         * @access Private - audit:admin
         */
        this.router.post('/escalation-policy', (0, auth_middleware_1.requirePermission)('escalation_policy:update'), (0, validate_middleware_1.validate)(escalation_request_dto_1.UpsertEscalationPolicyRequestSchema), this._createOrUpdateEscalationPolicy.bind(this));
    }
    async _getEscalationHistory(req, res, next) {
        try {
            const escalations = await this.escalationService.getEscalationHistory(req.params.type, req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(escalations));
        }
        catch (err) {
            next(err);
        }
    }
    async _acknowledgeEscalation(req, res, next) {
        try {
            const escalation = await this.escalationService.acknowledgeEscalation(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(escalation, 'Escalation acknowledged'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listEscalationPolicies(_req, res, next) {
        try {
            const policies = await this.escalationService.listEscalationPolicies();
            res.status(200).json((0, api_response_type_1.buildResponse)(policies));
        }
        catch (err) {
            next(err);
        }
    }
    async _createOrUpdateEscalationPolicy(req, res, next) {
        try {
            const policy = await this.escalationService.createOrUpdateEscalationPolicy(req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(policy, 'Escalation policy saved'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.EscalationController = EscalationController;
//# sourceMappingURL=escalation.controller.js.map