"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityTestController = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const security_test_request_dto_1 = require("../dto/request/security-test.request.dto");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
class SecurityTestController {
    securityTestService;
    router;
    constructor(securityTestService) {
        this.securityTestService = securityTestService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /system-audit/security-tests
         * @desc   List vulnerability assessments and penetration tests
         * @access Private - sectest:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('sectest:read'), (0, validate_middleware_1.validate)(security_test_request_dto_1.SecurityTestListQuerySchema, 'query'), this._list.bind(this));
        /**
         * @route  POST /system-audit/security-tests
         * @desc   Plan a security test (scope, schedule, provider, assets in scope)
         * @access Private - sectest:manage
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('sectest:manage'), (0, validate_middleware_1.validate)(security_test_request_dto_1.CreateSecurityTestSchema), this._create.bind(this));
        /**
         * @route  GET /system-audit/security-tests/:id
         * @desc   Security test detail with linked scan analyses and results
         * @access Private - sectest:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('sectest:read'), this._get.bind(this));
        /**
         * @route  PUT /system-audit/security-tests/:id
         * @desc   Update a security test (changing agreed terms voids an authorisation)
         * @access Private - sectest:manage
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('sectest:manage'), (0, validate_middleware_1.validate)(security_test_request_dto_1.UpdateSecurityTestSchema), this._update.bind(this));
        /**
         * @route  DELETE /system-audit/security-tests/:id
         * @desc   Soft-delete a planned or cancelled security test
         * @access Private - sectest:manage
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('sectest:manage'), this._delete.bind(this));
        /**
         * @route  POST /system-audit/security-tests/:id/authorise
         * @desc   Give written authorisation to test (never the coordinator or creator)
         * @access Private - sectest:authorise
         */
        this.router.post('/:id/authorise', (0, auth_middleware_1.requirePermission)('sectest:authorise'), (0, validate_middleware_1.validate)(security_test_request_dto_1.AuthoriseSecurityTestSchema), this._authorise.bind(this));
        /**
         * @route  PATCH /system-audit/security-tests/:id/status
         * @desc   Move the test through its lifecycle (in progress → reporting → remediation → closed)
         * @access Private - sectest:manage
         */
        this.router.patch('/:id/status', (0, auth_middleware_1.requirePermission)('sectest:manage'), (0, validate_middleware_1.validate)(security_test_request_dto_1.ChangeSecurityTestStatusSchema), this._changeStatus.bind(this));
        /**
         * @route  POST /system-audit/security-tests/:id/assets
         * @desc   Add registry assets to the test scope
         * @access Private - sectest:manage
         */
        this.router.post('/:id/assets', (0, auth_middleware_1.requirePermission)('sectest:manage'), (0, validate_middleware_1.validate)(security_test_request_dto_1.SecurityTestAssetsSchema), this._addAssets.bind(this));
        /**
         * @route  DELETE /system-audit/security-tests/:id/assets/:assetId
         * @desc   Remove an asset from the test scope
         * @access Private - sectest:manage
         */
        this.router.delete('/:id/assets/:assetId', (0, auth_middleware_1.requirePermission)('sectest:manage'), this._removeAsset.bind(this));
        /**
         * @route  POST /system-audit/security-tests/:id/report
         * @desc   Attach (or version) the tester's report
         * @access Private - sectest:manage
         */
        this.router.post('/:id/report', (0, auth_middleware_1.requirePermission)('sectest:manage'), upload.single('file'), this._uploadReport.bind(this));
        /**
         * @route  GET /system-audit/security-tests/:id/report
         * @desc   Download the current test report
         * @access Private - sectest:read
         */
        this.router.get('/:id/report', (0, auth_middleware_1.requirePermission)('sectest:read'), this._downloadReport.bind(this));
    }
    async _list(req, res, next) {
        try {
            const { tests, meta } = await this.securityTestService.listTests(req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(tests, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _create(req, res, next) {
        try {
            const test = await this.securityTestService.createTest(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(test, 'Security test planned'));
        }
        catch (err) {
            next(err);
        }
    }
    async _get(req, res, next) {
        try {
            const test = await this.securityTestService.getTest(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(test));
        }
        catch (err) {
            next(err);
        }
    }
    async _update(req, res, next) {
        try {
            const test = await this.securityTestService.updateTest(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(test, 'Security test updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _delete(req, res, next) {
        try {
            await this.securityTestService.deleteTest(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Security test deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _authorise(req, res, next) {
        try {
            const test = await this.securityTestService.authoriseTest(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(test, 'Security test authorised'));
        }
        catch (err) {
            next(err);
        }
    }
    async _changeStatus(req, res, next) {
        try {
            const test = await this.securityTestService.changeStatus(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(test, 'Status updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _addAssets(req, res, next) {
        try {
            const test = await this.securityTestService.addAssets(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(test, 'Scope updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _removeAsset(req, res, next) {
        try {
            const test = await this.securityTestService.removeAsset(req.params.id, req.params.assetId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(test, 'Scope updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _uploadReport(req, res, next) {
        try {
            if (!req.file)
                throw app_error_1.AppError.badRequest('Attach the report (multipart field "file")');
            const test = await this.securityTestService.uploadReport(req.params.id, {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype || 'application/octet-stream',
                fileSize: req.file.size,
                buffer: req.file.buffer,
            }, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(test, 'Report attached'));
        }
        catch (err) {
            next(err);
        }
    }
    async _downloadReport(req, res, next) {
        try {
            const file = await this.securityTestService.getReportFile(req.params.id, req.user);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SecurityTestController = SecurityTestController;
//# sourceMappingURL=security-test.controller.js.map