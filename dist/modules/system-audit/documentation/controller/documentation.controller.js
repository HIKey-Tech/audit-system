"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemDocumentationController = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const documentation_request_dto_1 = require("../dto/request/documentation.request.dto");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const fileFrom = (req) => {
    if (!req.file)
        throw app_error_1.AppError.badRequest('Attach the document (multipart field "file")');
    return {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'application/octet-stream',
        fileSize: req.file.size,
        buffer: req.file.buffer,
    };
};
class SystemDocumentationController {
    documentationService;
    router;
    constructor(documentationService) {
        this.documentationService = documentationService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /system-audit/documentation
         * @desc   Library of policies, diagrams, manuals, plans, and contracts (filter by scope)
         * @access Private - sysdoc:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('sysdoc:read'), (0, validate_middleware_1.validate)(documentation_request_dto_1.SystemDocumentListQuerySchema, 'query'), this._list.bind(this));
        /**
         * @route  GET /system-audit/documentation/summary
         * @desc   Counts by type, overdue reviews, and expiring contracts
         * @access Private - sysdoc:read
         */
        this.router.get('/summary', (0, auth_middleware_1.requirePermission)('sysdoc:read'), this._summary.bind(this));
        /**
         * @route  POST /system-audit/documentation
         * @desc   Add a document to the library (multipart: file + metadata)
         * @access Private - sysdoc:manage
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('sysdoc:manage'), upload.single('file'), (0, validate_middleware_1.validate)(documentation_request_dto_1.CreateSystemDocumentSchema), this._create.bind(this));
        /**
         * @route  GET /system-audit/documentation/:id
         * @desc   One library document
         * @access Private - sysdoc:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('sysdoc:read'), this._get.bind(this));
        /**
         * @route  PUT /system-audit/documentation/:id
         * @desc   Update document metadata, scope links, review and expiry dates, or archive it
         * @access Private - sysdoc:manage
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('sysdoc:manage'), (0, validate_middleware_1.validate)(documentation_request_dto_1.UpdateSystemDocumentSchema), this._update.bind(this));
        /**
         * @route  DELETE /system-audit/documentation/:id
         * @desc   Remove a document from the library (soft delete)
         * @access Private - sysdoc:manage
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('sysdoc:manage'), this._remove.bind(this));
        /**
         * @route  POST /system-audit/documentation/:id/versions
         * @desc   Upload a new version; the previous file stays in the version history
         * @access Private - sysdoc:manage
         */
        this.router.post('/:id/versions', (0, auth_middleware_1.requirePermission)('sysdoc:manage'), upload.single('file'), (0, validate_middleware_1.validate)(documentation_request_dto_1.UploadSystemDocumentVersionSchema), this._uploadVersion.bind(this));
        /**
         * @route  GET /system-audit/documentation/:id/download
         * @desc   Download the current version
         * @access Private - sysdoc:read
         */
        this.router.get('/:id/download', (0, auth_middleware_1.requirePermission)('sysdoc:read'), this._download.bind(this));
    }
    async _list(req, res, next) {
        try {
            const { documents, meta } = await this.documentationService.list(req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(documents, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _summary(_req, res, next) {
        try {
            res.status(200).json((0, api_response_type_1.buildResponse)(await this.documentationService.summary()));
        }
        catch (err) {
            next(err);
        }
    }
    async _create(req, res, next) {
        try {
            const doc = await this.documentationService.create(req.body, fileFrom(req), req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(doc, 'Document added to the library'));
        }
        catch (err) {
            next(err);
        }
    }
    async _get(req, res, next) {
        try {
            res.status(200).json((0, api_response_type_1.buildResponse)(await this.documentationService.get(req.params.id)));
        }
        catch (err) {
            next(err);
        }
    }
    async _update(req, res, next) {
        try {
            const doc = await this.documentationService.update(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(doc, 'Document updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _remove(req, res, next) {
        try {
            await this.documentationService.remove(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Document removed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _uploadVersion(req, res, next) {
        try {
            const doc = await this.documentationService.uploadVersion(req.params.id, req.body, fileFrom(req), req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(doc, 'New version uploaded'));
        }
        catch (err) {
            next(err);
        }
    }
    async _download(req, res, next) {
        try {
            const file = await this.documentationService.getFile(req.params.id, req.user);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SystemDocumentationController = SystemDocumentationController;
//# sourceMappingURL=documentation.controller.js.map