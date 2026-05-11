"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const monitoring_request_dto_1 = require("../dto/request/monitoring.request.dto");
class MonitoringController {
    monitoringService;
    router;
    constructor(monitoringService) {
        this.monitoringService = monitoringService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /risk/monitoring/high-risk
         * @desc   List high-risk register items
         * @access Private - audit:read
         */
        this.router.get('/monitoring/high-risk', (0, auth_middleware_1.requirePermission)('risk_monitoring:read'), (0, validate_middleware_1.validate)(monitoring_request_dto_1.HighRiskQuerySchema, 'query'), this._getHighRiskItems.bind(this));
        /**
         * @route  GET /risk/monitoring/attention-required
         * @desc   List risks requiring assessment attention
         * @access Private - audit:read
         */
        this.router.get('/monitoring/attention-required', (0, auth_middleware_1.requirePermission)('risk_monitoring:read'), this._getRisksRequiringAttention.bind(this));
        /**
         * @route  GET /risk/monitoring/summary
         * @desc   Get organization risk summary
         * @access Private - audit:read
         */
        this.router.get('/monitoring/summary', (0, auth_middleware_1.requirePermission)('risk_monitoring:read'), this._getOrganizationRiskSummary.bind(this));
        /**
         * @route  GET /risk/register/:id/trend
         * @desc   Get risk score trend
         * @access Private - audit:read
         */
        this.router.get('/register/:id/trend', (0, auth_middleware_1.requirePermission)('risk:read'), this._getRiskScoreTrend.bind(this));
    }
    async _getHighRiskItems(req, res, next) {
        try {
            const { risks, meta } = await this.monitoringService.getHighRiskItems(req.query, req.user);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(risks), meta });
        }
        catch (err) {
            next(err);
        }
    }
    async _getRisksRequiringAttention(req, res, next) {
        try {
            const risks = await this.monitoringService.getRisksRequiringAttention(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(risks));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRiskScoreTrend(req, res, next) {
        try {
            const trend = await this.monitoringService.getRiskScoreTrend(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(trend));
        }
        catch (err) {
            next(err);
        }
    }
    async _getOrganizationRiskSummary(req, res, next) {
        try {
            const summary = await this.monitoringService.getOrganizationRiskSummary(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(summary));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.MonitoringController = MonitoringController;
//# sourceMappingURL=monitoring.controller.js.map