"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinuousMonitoringController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
class ContinuousMonitoringController {
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
         * @route  GET /system-audit/monitoring/dashboard
         * @desc   Continuous monitoring: check status, open exceptions, trends, security events, emerging risks
         * @access Private - sysaudit:read
         */
        this.router.get('/dashboard', (0, auth_middleware_1.requirePermission)('sysaudit:read'), this._getDashboard.bind(this));
        /**
         * @route  POST /system-audit/monitoring/run
         * @desc   Run every enabled, connected monitoring check now
         * @access Private - sysaudit:admin
         */
        this.router.post('/run', (0, auth_middleware_1.requirePermission)('sysaudit:admin'), this._runNow.bind(this));
    }
    async _getDashboard(req, res, next) {
        try {
            const dashboard = await this.monitoringService.getDashboard(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(dashboard));
        }
        catch (err) {
            next(err);
        }
    }
    async _runNow(req, res, next) {
        try {
            const result = await this.monitoringService.runChecksNow(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(result, 'Monitoring checks completed'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ContinuousMonitoringController = ContinuousMonitoringController;
//# sourceMappingURL=monitoring.controller.js.map