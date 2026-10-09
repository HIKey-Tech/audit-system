"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const logging_request_dto_1 = require("../dto/request/logging.request.dto");
class LoggingController {
    auditLogService;
    systemLogService;
    router;
    constructor(auditLogService, systemLogService) {
        this.auditLogService = auditLogService;
        this.systemLogService = systemLogService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        // All logging routes require authentication
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /logs/modules
         * @desc   List distinct modules that have audit log entries
         * @access Private - log:read
         */
        this.router.get('/modules', (0, auth_middleware_1.requirePermission)('log:read'), this._getDistinctModules.bind(this));
        /**
         * @route  GET /logs/summary
         * @desc   Get audit log aggregate counts grouped by module and status
         * @access Private - log:admin
         */
        this.router.get('/summary', (0, auth_middleware_1.requirePermission)('log:summary'), (0, validate_middleware_1.validate)(logging_request_dto_1.AuditLogSummaryQuerySchema, 'query'), this._getLogSummary.bind(this));
        /**
         * @route  GET /logs/security/summary
         * @desc   Security event monitoring — sign-ins, failures, denials, token reuse over a window
         * @access Private - log:read
         */
        this.router.get('/security/summary', (0, auth_middleware_1.requirePermission)('log:read'), (0, validate_middleware_1.validate)(logging_request_dto_1.SecuritySummaryQuerySchema, 'query'), this._getSecuritySummary.bind(this));
        /**
         * @route  GET /logs/system
         * @desc   List persisted application exceptions (system exceptions)
         * @access Private - log:read
         */
        this.router.get('/system', (0, auth_middleware_1.requirePermission)('log:read'), (0, validate_middleware_1.validate)(logging_request_dto_1.SystemLogListQuerySchema, 'query'), this._listSystemLogs.bind(this));
        /**
         * @route  GET /logs/system/:id
         * @desc   Get one system exception, including its stack trace
         * @access Private - log:read
         */
        this.router.get('/system/:id', (0, auth_middleware_1.requirePermission)('log:read'), (0, validate_middleware_1.validate)(logging_request_dto_1.AuditLogIdParamsSchema, 'params'), this._getSystemLogById.bind(this));
        /**
         * @route  GET /logs/export
         * @desc   Export the (filtered) audit trail as CSV or Excel
         * @access Private - log:read + log:export
         */
        this.router.get('/export', (0, auth_middleware_1.requirePermission)('log:read', 'log:export'), (0, validate_middleware_1.validate)(logging_request_dto_1.AuditLogExportQuerySchema, 'query'), this._exportLogs.bind(this));
        /**
         * @route  GET /logs
         * @desc   List audit logs (paginated, filterable, sortable)
         * @access Private - log:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('log:read'), (0, validate_middleware_1.validate)(logging_request_dto_1.AuditLogListQuerySchema, 'query'), this._listLogs.bind(this));
        /**
         * @route  GET /logs/verify-chain
         * @desc   Verify the audit-log tamper-evidence chain; reports the first break
         * @access Private - log:read
         * @note   Registered before /:id so the literal path is not captured as an id.
         */
        this.router.get('/verify-chain', (0, auth_middleware_1.requirePermission)('log:read'), this._verifyChain.bind(this));
        /**
         * @route  GET /logs/:id
         * @desc   Get a single audit log entry by ID
         * @access Private - log:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('log:read'), (0, validate_middleware_1.validate)(logging_request_dto_1.AuditLogIdParamsSchema, 'params'), this._getLogById.bind(this));
    }
    async _verifyChain(_req, res, next) {
        try {
            const result = await this.auditLogService.verifyChain();
            const message = result.ok
                ? 'Audit log chain intact'
                : `Audit log chain broken: ${result.reason ?? 'unknown'}`;
            res.status(200).json((0, api_response_type_1.buildResponse)(result, message));
        }
        catch (err) {
            next(err);
        }
    }
    async _getSecuritySummary(req, res, next) {
        try {
            const summary = await this.auditLogService.getSecuritySummary(req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(summary));
        }
        catch (err) {
            next(err);
        }
    }
    async _listSystemLogs(req, res, next) {
        try {
            const { logs, meta } = await this.systemLogService.listSystemLogs(req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(logs, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _getSystemLogById(req, res, next) {
        try {
            const log = await this.systemLogService.getSystemLogById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(log));
        }
        catch (err) {
            next(err);
        }
    }
    async _exportLogs(req, res, next) {
        try {
            const { format, ...query } = req.query;
            const file = await this.auditLogService.exportLogs({ ...query, page: 1, pageSize: 1 }, format, req.user.id);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
    async _listLogs(req, res, next) {
        try {
            const query = req.query;
            const { logs, meta } = await this.auditLogService.listLogs(query);
            res.status(200).json((0, api_response_type_1.buildResponse)(logs, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _getLogById(req, res, next) {
        try {
            const log = await this.auditLogService.getLogById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(log));
        }
        catch (err) {
            next(err);
        }
    }
    async _getDistinctModules(_req, res, next) {
        try {
            const modules = await this.auditLogService.getDistinctModules();
            res.status(200).json((0, api_response_type_1.buildResponse)(modules));
        }
        catch (err) {
            next(err);
        }
    }
    async _getLogSummary(req, res, next) {
        try {
            const query = req.query;
            const summary = await this.auditLogService.getLogSummary(query);
            res.status(200).json((0, api_response_type_1.buildResponse)(summary));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.LoggingController = LoggingController;
//# sourceMappingURL=logging.controller.js.map