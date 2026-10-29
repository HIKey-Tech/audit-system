"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodicReportController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const periodic_report_dto_1 = require("../dto/periodic-report.dto");
const periodic_report_service_1 = require("../service/periodic-report.service");
class PeriodicReportController {
    periodicReportService;
    router;
    constructor(periodicReportService = new periodic_report_service_1.PeriodicReportService()) {
        this.periodicReportService = periodicReportService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /audit/periodic-reports
         * @desc   Get periodic audit activity report (monthly, quarterly, yearly, or custom)
         * @access Private - report:read | engagement:read | dashboard:read
         */
        this.router.get('/periodic-reports', (0, auth_middleware_1.requireAnyPermission)('report:read', 'engagement:read', 'dashboard:read'), (0, validate_middleware_1.validate)(periodic_report_dto_1.PeriodicReportQuerySchema, 'query'), this._getPeriodicReport.bind(this));
        /**
         * @route  GET /audit/periodic-reports/export
         * @desc   Export periodic audit activity report as Word (.docx) or PDF (.pdf)
         * @access Private - report:read | engagement:read | dashboard:read
         */
        this.router.get('/periodic-reports/export', (0, auth_middleware_1.requireAnyPermission)('report:read', 'engagement:read', 'dashboard:read'), (0, validate_middleware_1.validate)(periodic_report_dto_1.ExportPeriodicReportQuerySchema, 'query'), this._exportPeriodicReport.bind(this));
    }
    async _getPeriodicReport(req, res, next) {
        try {
            const query = req.query;
            const report = await this.periodicReportService.getPeriodicReport(query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(report, 'Periodic audit activity report retrieved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _exportPeriodicReport(req, res, next) {
        try {
            const query = req.query;
            const format = query.format === 'docx' ? 'docx' : 'pdf';
            const file = await this.periodicReportService.exportPeriodicReport(query, format, req.user);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.PeriodicReportController = PeriodicReportController;
//# sourceMappingURL=periodic-report.controller.js.map