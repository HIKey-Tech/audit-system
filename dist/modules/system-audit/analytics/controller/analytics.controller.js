"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemAuditAnalyticsController = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const extract_parser_utility_1 = require("../../utility/extract-parser.utility");
const analytics_request_dto_1 = require("../dto/request/analytics.request.dto");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const extractFrom = (req) => {
    if (!req.file)
        throw app_error_1.AppError.badRequest('Attach the system export (multipart field "file")');
    if (!(0, extract_parser_utility_1.isSupportedExtract)(req.file.originalname)) {
        throw app_error_1.AppError.badRequest('Upload a CSV, TSV, or Excel (.xlsx/.xls) export');
    }
    return {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'application/octet-stream',
        fileSize: req.file.size,
        buffer: req.file.buffer,
    };
};
class SystemAuditAnalyticsController {
    analyticsService;
    router;
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /system-audit/analytics/types
         * @desc   Catalogue of analyses: fields, rules, default parameters, live sources
         * @access Private - sysaudit:read
         */
        this.router.get('/types', (0, auth_middleware_1.requirePermission)('sysaudit:read'), this._listTypes.bind(this));
        /**
         * @route  POST /system-audit/analytics/preview
         * @desc   Read an export's headers and suggest the column mapping (nothing is stored)
         * @access Private - sysaudit:run
         */
        this.router.post('/preview', (0, auth_middleware_1.requirePermission)('sysaudit:run'), upload.single('file'), (0, validate_middleware_1.validate)(analytics_request_dto_1.PreviewExtractSchema), this._preview.bind(this));
        /**
         * @route  POST /system-audit/analytics/runs
         * @desc   Analyse an uploaded system export; the file is kept as hashed evidence
         * @access Private - sysaudit:run
         */
        this.router.post('/runs', (0, auth_middleware_1.requirePermission)('sysaudit:run'), upload.single('file'), (0, validate_middleware_1.validate)(analytics_request_dto_1.RunUploadAnalysisSchema), this._runUpload.bind(this));
        /**
         * @route  POST /system-audit/analytics/runs/live
         * @desc   Analyse live read-only data (IAMS users/security events, Entra ID, IMOC)
         * @access Private - sysaudit:run
         */
        this.router.post('/runs/live', (0, auth_middleware_1.requirePermission)('sysaudit:run'), (0, validate_middleware_1.validate)(analytics_request_dto_1.RunLiveAnalysisSchema), this._runLive.bind(this));
        /**
         * @route  GET /system-audit/analytics/runs
         * @desc   List analysis runs visible to the caller
         * @access Private - sysaudit:read
         */
        this.router.get('/runs', (0, auth_middleware_1.requirePermission)('sysaudit:read'), (0, validate_middleware_1.validate)(analytics_request_dto_1.RunListQuerySchema, 'query'), this._listRuns.bind(this));
        /**
         * @route  POST /system-audit/analytics/exceptions/disposition
         * @desc   Disposition one or more exceptions (confirmed / false positive / explained / reopen)
         * @access Private - sysaudit:review
         */
        this.router.post('/exceptions/disposition', (0, auth_middleware_1.requirePermission)('sysaudit:review'), (0, validate_middleware_1.validate)(analytics_request_dto_1.DispositionExceptionsSchema), this._disposition.bind(this));
        /**
         * @route  GET /system-audit/analytics/runs/:id
         * @desc   Run detail — summary, rule and disposition counts, access-review progress
         * @access Private - sysaudit:read
         */
        this.router.get('/runs/:id', (0, auth_middleware_1.requirePermission)('sysaudit:read'), this._getRun.bind(this));
        /**
         * @route  GET /system-audit/analytics/runs/:id/exceptions
         * @desc   Exceptions of a run, most severe first
         * @access Private - sysaudit:read
         */
        this.router.get('/runs/:id/exceptions', (0, auth_middleware_1.requirePermission)('sysaudit:read'), (0, validate_middleware_1.validate)(analytics_request_dto_1.ExceptionListQuerySchema, 'query'), this._listExceptions.bind(this));
        /**
         * @route  GET /system-audit/analytics/runs/:id/exceptions/export
         * @desc   Export a run's exceptions as CSV or Excel
         * @access Private - sysaudit:read
         */
        this.router.get('/runs/:id/exceptions/export', (0, auth_middleware_1.requirePermission)('sysaudit:read'), (0, validate_middleware_1.validate)(analytics_request_dto_1.ExceptionExportQuerySchema, 'query'), this._exportExceptions.bind(this));
        /**
         * @route  GET /system-audit/analytics/runs/:id/extract
         * @desc   Download the original extract the run analysed
         * @access Private - sysaudit:read
         */
        this.router.get('/runs/:id/extract', (0, auth_middleware_1.requirePermission)('sysaudit:read'), this._downloadExtract.bind(this));
        /**
         * @route  POST /system-audit/analytics/runs/:id/findings
         * @desc   Raise an audit finding from selected exceptions
         * @access Private - sysaudit:review + finding:create
         */
        this.router.post('/runs/:id/findings', (0, auth_middleware_1.requirePermission)('sysaudit:review', 'finding:create'), (0, validate_middleware_1.validate)(analytics_request_dto_1.RaiseFindingSchema), this._raiseFinding.bind(this));
        /**
         * @route  POST /system-audit/analytics/runs/:id/baseline
         * @desc   Approve a configuration review as the system's baseline
         * @access Private - sysaudit:admin
         */
        this.router.post('/runs/:id/baseline', (0, auth_middleware_1.requirePermission)('sysaudit:admin'), this._markBaseline.bind(this));
        /**
         * @route  POST /system-audit/analytics/runs/:id/complete-review
         * @desc   Sign off a run once every exception (and account) has been dispositioned
         * @access Private - sysaudit:review
         */
        this.router.post('/runs/:id/complete-review', (0, auth_middleware_1.requirePermission)('sysaudit:review'), (0, validate_middleware_1.validate)(analytics_request_dto_1.CompleteReviewSchema), this._completeReview.bind(this));
    }
    _listTypes(_req, res, next) {
        try {
            res.status(200).json((0, api_response_type_1.buildResponse)(this.analyticsService.listAnalysisTypes()));
        }
        catch (err) {
            next(err);
        }
    }
    _preview(req, res, next) {
        try {
            const preview = this.analyticsService.previewExtract(req.body, extractFrom(req));
            res.status(200).json((0, api_response_type_1.buildResponse)(preview, 'Extract read'));
        }
        catch (err) {
            next(err);
        }
    }
    async _runUpload(req, res, next) {
        try {
            const run = await this.analyticsService.runUploadAnalysis(req.body, extractFrom(req), req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(run, 'Analysis completed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _runLive(req, res, next) {
        try {
            const run = await this.analyticsService.runLiveAnalysis(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(run, 'Analysis completed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listRuns(req, res, next) {
        try {
            const { runs, meta } = await this.analyticsService.listRuns(req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(runs, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRun(req, res, next) {
        try {
            const run = await this.analyticsService.getRun(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(run));
        }
        catch (err) {
            next(err);
        }
    }
    async _listExceptions(req, res, next) {
        try {
            const { exceptions, meta } = await this.analyticsService.listExceptions(req.params.id, req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(exceptions, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _exportExceptions(req, res, next) {
        try {
            const { format } = req.query;
            const file = await this.analyticsService.exportExceptions(req.params.id, format, req.user);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
    async _downloadExtract(req, res, next) {
        try {
            const file = await this.analyticsService.getExtractFile(req.params.id, req.user);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
    async _disposition(req, res, next) {
        try {
            const result = await this.analyticsService.dispositionExceptions(req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(result, 'Exceptions updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _raiseFinding(req, res, next) {
        try {
            const result = await this.analyticsService.raiseFinding(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(result, 'Finding raised'));
        }
        catch (err) {
            next(err);
        }
    }
    async _markBaseline(req, res, next) {
        try {
            const run = await this.analyticsService.markBaseline(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(run, 'Baseline approved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _completeReview(req, res, next) {
        try {
            const run = await this.analyticsService.completeReview(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(run, 'Review completed'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SystemAuditAnalyticsController = SystemAuditAnalyticsController;
//# sourceMappingURL=analytics.controller.js.map