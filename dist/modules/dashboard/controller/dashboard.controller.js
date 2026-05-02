"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const dashboard_request_dto_1 = require("../dto/request/dashboard.request.dto");
class DashboardController {
    dashboardService;
    router;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        // All dashboard routes require authentication.
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /dashboard/summary
         * @desc   Audit programme summary (engagements + plans, role-aware)
         * @access Private — audit:read
         */
        this.router.get('/summary', (0, auth_middleware_1.requirePermission)('audit:read'), this._getAuditSummary.bind(this));
        /**
         * @route  GET /dashboard/findings
         * @desc   Findings summary (severity / status / resolution metrics)
         * @access Private — finding:read
         */
        this.router.get('/findings', (0, auth_middleware_1.requirePermission)('finding:read'), this._getFindingsSummary.bind(this));
        /**
         * @route  GET /dashboard/risks
         * @desc   Risk register overview (band / status / top five / stale count)
         * @access Private — audit:read
         */
        this.router.get('/risks', (0, auth_middleware_1.requirePermission)('audit:read'), this._getRiskOverview.bind(this));
        /**
         * @route  GET /dashboard/activity
         * @desc   Recent audit-trail activity across audit, workflow, risk, document, user
         * @access Private — audit:read
         */
        this.router.get('/activity', (0, auth_middleware_1.requirePermission)('audit:read'), (0, validate_middleware_1.validate)(dashboard_request_dto_1.ActivityQuerySchema, 'query'), this._getRecentActivity.bind(this));
        /**
         * @route  GET /dashboard/escalations
         * @desc   Active escalations overview (level / recent list)
         * @access Private — audit:read
         */
        this.router.get('/escalations', (0, auth_middleware_1.requirePermission)('audit:read'), this._getEscalationOverview.bind(this));
        /**
         * @route  GET /dashboard/my-work
         * @desc   Personal work bundle for the current user
         * @access Private — audit:read
         */
        this.router.get('/my-work', (0, auth_middleware_1.requirePermission)('audit:read'), this._getMyWork.bind(this));
        /**
         * @route  GET /dashboard/approval-inbox
         * @desc   Personal approval inbox summary for the current user
         * @access Private — audit:read
         */
        this.router.get('/approval-inbox', (0, auth_middleware_1.requirePermission)('audit:read'), this._getApprovalInboxSummary.bind(this));
    }
    async _getAuditSummary(req, res, next) {
        try {
            const summary = await this.dashboardService.getAuditSummary(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(summary));
        }
        catch (err) {
            next(err);
        }
    }
    async _getFindingsSummary(req, res, next) {
        try {
            const summary = await this.dashboardService.getFindingsSummary(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(summary));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRiskOverview(req, res, next) {
        try {
            const overview = await this.dashboardService.getRiskOverview(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(overview));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRecentActivity(req, res, next) {
        try {
            const { limit } = req.query;
            const activity = await this.dashboardService.getRecentActivity(req.user, limit);
            res.status(200).json((0, api_response_type_1.buildResponse)(activity));
        }
        catch (err) {
            next(err);
        }
    }
    async _getEscalationOverview(req, res, next) {
        try {
            const overview = await this.dashboardService.getEscalationOverview(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(overview));
        }
        catch (err) {
            next(err);
        }
    }
    async _getMyWork(req, res, next) {
        try {
            const work = await this.dashboardService.getMyWork(req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(work));
        }
        catch (err) {
            next(err);
        }
    }
    async _getApprovalInboxSummary(req, res, next) {
        try {
            const summary = await this.dashboardService.getApprovalInboxSummary(req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(summary));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=dashboard.controller.js.map