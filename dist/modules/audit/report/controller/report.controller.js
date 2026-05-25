"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const report_request_dto_1 = require("../dto/request/report.request.dto");
class ReportController {
    reportService;
    router;
    constructor(reportService) {
        this.reportService = reportService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/engagements/:id/report/generate
         * @desc   Generate audit report
         * @access Private - audit:write
         */
        this.router.post('/engagements/:id/report/generate', (0, auth_middleware_1.requirePermission)('report:create'), this._generateReport.bind(this));
        /**
         * @route  GET /audit/engagements/:id/report
         * @desc   Get audit report for engagement
         * @access Private - audit:read
         */
        this.router.get('/engagements/:id/report', (0, auth_middleware_1.requirePermission)('report:read'), this._getReport.bind(this));
        /**
         * @route  GET /audit/reports
         * @desc   List audit reports
         * @access Private - audit:read
         */
        this.router.get('/reports', (0, auth_middleware_1.requirePermission)('report:read'), (0, validate_middleware_1.validate)(report_request_dto_1.ReportQuerySchema, 'query'), this._listReports.bind(this));
        /**
         * @route  GET /audit/reports/:id
         * @desc   Get audit report by id
         * @access Private - audit:read
         */
        this.router.get('/reports/:id', (0, auth_middleware_1.requirePermission)('report:read'), this._getReportById.bind(this));
        /**
         * @route  PUT /audit/reports/:id
         * @desc   Update audit report
         * @access Private - audit:write
         */
        this.router.put('/reports/:id', (0, auth_middleware_1.requirePermission)('report:update'), (0, validate_middleware_1.validate)(report_request_dto_1.UpdateReportRequestSchema), this._updateReport.bind(this));
        /**
         * @route  POST /audit/reports/:id/submit
         * @desc   Submit audit report
         * @access Private - audit:write
         */
        this.router.post('/reports/:id/submit', (0, auth_middleware_1.requirePermission)('report:submit'), this._submitReportForApproval.bind(this));
        /**
         * @route  POST /audit/reports/:id/approve
         * @desc   Approve audit report
         * @access Private - audit:admin
         */
        this.router.post('/reports/:id/approve', (0, auth_middleware_1.requirePermission)('report:approve'), this._approveReport.bind(this));
        /**
         * @route  POST /audit/reports/:id/reject
         * @desc   Reject audit report
         * @access Private - audit:admin
         */
        this.router.post('/reports/:id/reject', (0, auth_middleware_1.requirePermission)('report:reject'), (0, validate_middleware_1.validate)(report_request_dto_1.RejectReportRequestSchema), this._rejectReport.bind(this));
        /**
         * @route  POST /audit/reports/:id/issue
         * @desc   Issue audit report
         * @access Private - audit:admin
         */
        this.router.post('/reports/:id/issue', (0, auth_middleware_1.requirePermission)('report:issue'), this._issueReport.bind(this));
        /**
         * @route  GET /audit/reports/:id/export
         * @desc   Export audit report
         * @access Private - audit:read
         */
        this.router.get('/reports/:id/export', (0, auth_middleware_1.requirePermission)('report:export'), (0, validate_middleware_1.validate)(report_request_dto_1.ExportReportQuerySchema, 'query'), this._exportReport.bind(this));
    }
    async _generateReport(req, res, next) {
        try {
            const report = await this.reportService.generateReport(req.params.id, req.body ?? {}, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(report, 'Audit report generated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateReport(req, res, next) {
        try {
            const report = await this.reportService.updateReport(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(report, 'Audit report updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _submitReportForApproval(req, res, next) {
        try {
            const report = await this.reportService.submitReportForApproval(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(report, 'Audit report submitted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _approveReport(req, res, next) {
        try {
            const report = await this.reportService.approveReport(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(report, 'Audit report approved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _rejectReport(req, res, next) {
        try {
            const report = await this.reportService.rejectReport(req.params.id, req.body.reason, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(report, 'Audit report rejected'));
        }
        catch (err) {
            next(err);
        }
    }
    async _issueReport(req, res, next) {
        try {
            const report = await this.reportService.issueReport(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(report, 'Audit report issued'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getReport(req, res, next) {
        try {
            const report = await this.reportService.getReport(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(report));
        }
        catch (err) {
            next(err);
        }
    }
    async _getReportById(req, res, next) {
        try {
            const report = await this.reportService.getReportById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(report));
        }
        catch (err) {
            next(err);
        }
    }
    async _listReports(req, res, next) {
        try {
            const { reports, meta } = await this.reportService.listReports(req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(reports, 'Audit reports retrieved', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _exportReport(req, res, next) {
        try {
            const format = req.query.format ?? 'pdf';
            const file = await this.reportService.exportReport(req.params.id, format);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ReportController = ReportController;
//# sourceMappingURL=report.controller.js.map