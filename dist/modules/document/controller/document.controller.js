"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentController = void 0;
// src/modules/document/controller/document.controller.ts
const path_1 = __importDefault(require("path"));
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const app_error_1 = require("../../../shared/errors/app.error");
const document_request_dto_1 = require("../dto/request/document.request.dto");
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
// Allowlist of document/evidence file types. Anything else (HTML, SVG, scripts,
// executables, …) is rejected up front. This is the first gate only — it does
// not inspect file contents; deep magic-byte validation and malware scanning
// remain recommended defence-in-depth for ingested third-party evidence.
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.rtf', '.odt', '.ods', '.odp', '.csv', '.txt', '.xml', '.json',
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.heic', '.heif',
    // Email
    '.msg', '.eml',
    // Archives
    '.zip', '.7z', '.rar',
]);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/rtf',
    'text/rtf',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'text/csv',
    'text/plain',
    'application/xml',
    'text/xml',
    'application/json',
    // Images
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/heic',
    'image/heif',
    // Email
    'application/vnd.ms-outlook',
    'message/rfc822',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-7z-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
    // Many clients send a generic type for the formats above; the extension gate
    // still constrains it to the allowlist (HTML/SVG/scripts/executables blocked).
    'application/octet-stream',
]);
const uploadFileFilter = (_req, file, cb) => {
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (ALLOWED_UPLOAD_EXTENSIONS.has(ext) && ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
        return;
    }
    cb(app_error_1.AppError.badRequest(`Unsupported file type: "${file.originalname}"`));
};
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: uploadFileFilter,
});
class DocumentController {
    documentService;
    router;
    constructor(documentService) {
        this.documentService = documentService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        // All document routes require authentication
        this.router.use(auth_middleware_1.authenticate);
        // ────────── Templates (must be registered before `/:id`) ──────────
        /**
         * @route  POST /documents/templates
         * @desc   Create a document template
         * @access Private — document:write
         */
        this.router.post('/templates', (0, auth_middleware_1.requirePermission)('document_template:write'), (0, validate_middleware_1.validate)(document_request_dto_1.CreateTemplateRequestSchema), this._createTemplate.bind(this));
        /**
         * @route  GET /documents/templates
         * @desc   List templates (paginated, filterable)
         * @access Private — document:read
         */
        this.router.get('/templates', (0, auth_middleware_1.requirePermission)('document_template:read'), (0, validate_middleware_1.validate)(document_request_dto_1.TemplateQuerySchema, 'query'), this._listTemplates.bind(this));
        /**
         * @route  GET /documents/templates/:id
         * @desc   Get a template by ID
         * @access Private — document:read
         */
        this.router.get('/templates/:id', (0, auth_middleware_1.requirePermission)('document_template:read'), this._getTemplateById.bind(this));
        /**
         * @route  PATCH /documents/templates/:id
         * @desc   Update a template
         * @access Private — document:write
         */
        this.router.patch('/templates/:id', (0, auth_middleware_1.requirePermission)('document_template:write'), (0, validate_middleware_1.validate)(document_request_dto_1.UpdateTemplateRequestSchema), this._updateTemplate.bind(this));
        /**
         * @route  DELETE /documents/templates/:id
         * @desc   Soft-delete a template
         * @access Private — document:delete
         */
        this.router.delete('/templates/:id', (0, auth_middleware_1.requirePermission)('document_template:delete'), this._deleteTemplate.bind(this));
        // ────────── Document listing by entity ──────────
        /**
         * @route  GET /documents/by-entity/:entityType/:entityId
         * @desc   List documents attached to an entity
         * @access Private — document:read
         */
        this.router.get('/by-entity/:entityType/:entityId', (0, auth_middleware_1.requirePermission)('document:read'), this._listByEntity.bind(this));
        // ────────── File serving (target of LocalStorageClient.getUrl) ──────────
        /**
         * @route  GET /documents/serve/:storedName
         * @desc   Stream the raw file bytes for a document or historical version.
         *         `storedName` is the storage key returned by the storage adapter
         *         (see LocalStorageClient.getUrl). Resolved against Document and
         *         Document_Version storage_path columns.
         * @access Private — document:read
         */
        this.router.get('/serve/:storedName', (0, auth_middleware_1.requirePermission)('document:read'), this._serve.bind(this));
        // ────────── Document CRUD ──────────
        /**
         * @route  GET /documents
         * @desc   List documents (paginated, optional entityType + search filters)
         * @access Private — document:read
         */
        this.router.get('/', 
        // Personal storage: the listing is scoped to the authenticated user's own
        // uploads (see DocumentService.list ownerId), so no permission is required
        // to view your own documents — only authentication.
        // requirePermission('document:read'),
        (0, validate_middleware_1.validate)(document_request_dto_1.DocumentListQuerySchema, 'query'), this._list.bind(this));
        /**
         * @route  POST /documents
         * @desc   Upload a new document (multipart/form-data, field "file")
         * @access Private — document:write
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('document:write'), upload.single('file'), (0, validate_middleware_1.validate)(document_request_dto_1.UploadDocumentMetadataSchema), this._upload.bind(this));
        /**
         * @route  GET /documents/:id
         * @desc   Get document metadata + download URL
         * @access Private — document:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('document:read'), this._getById.bind(this));
        /**
         * @route  GET /documents/:id/download
         * @desc   Get a download URL for a document
         * @access Private — document:read
         */
        this.router.get('/:id/download', (0, auth_middleware_1.requirePermission)('document:read'), this._getDownloadUrl.bind(this));
        /**
         * @route  GET /documents/:id/file
         * @desc   Stream the raw file bytes for a document, regardless of
         *         storage provider. Lets the browser download from a same-origin
         *         URL so cross-origin S3/Azure objects don't require bucket CORS.
         * @access Private — document:read
         */
        this.router.get('/:id/file', (0, auth_middleware_1.requirePermission)('document:read'), this._getFileById.bind(this));
        /**
         * @route  DELETE /documents/:id
         * @desc   Soft-delete a document
         * @access Private — document:delete
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('document:delete'), this._delete.bind(this));
        // ────────── Versioning ──────────
        /**
         * @route  POST /documents/:id/versions
         * @desc   Upload a new version of an existing document
         * @access Private — document:write
         */
        this.router.post('/:id/versions', (0, auth_middleware_1.requirePermission)('document:write'), upload.single('file'), (0, validate_middleware_1.validate)(document_request_dto_1.UploadVersionMetadataSchema), this._uploadNewVersion.bind(this));
        /**
         * @route  GET /documents/:id/versions
         * @desc   List all versions of a document (current + history)
         * @access Private — document:read
         */
        this.router.get('/:id/versions', (0, auth_middleware_1.requirePermission)('document:read'), this._listVersions.bind(this));
        /**
         * @route  GET /documents/:id/versions/:version
         * @desc   Get a specific version of a document
         * @access Private — document:read
         */
        this.router.get('/:id/versions/:version', (0, auth_middleware_1.requirePermission)('document:read'), this._getVersion.bind(this));
        /**
         * @route  GET /documents/:id/versions/:version/download
         * @desc   Get download URL for a specific version
         * @access Private — document:read
         */
        this.router.get('/:id/versions/:version/download', (0, auth_middleware_1.requirePermission)('document:read'), this._getVersionDownloadUrl.bind(this));
    }
    // ──────────────────────────────────────────────────────────
    // Document handlers
    // ──────────────────────────────────────────────────────────
    async _upload(req, res, next) {
        try {
            if (!req.file) {
                throw app_error_1.AppError.badRequest('File is required (multipart field "file")');
            }
            const document = await this.documentService.upload({
                uploadedById: req.user.id,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSize: req.file.size,
                buffer: req.file.buffer,
                module: req.body.module,
                entityType: req.body.entityType,
                entityId: req.body.entityId,
            });
            res.status(201).json((0, api_response_type_1.buildResponse)(document, 'Document uploaded'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getById(req, res, next) {
        try {
            const document = await this.documentService.getById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(document));
        }
        catch (err) {
            next(err);
        }
    }
    async _getDownloadUrl(req, res, next) {
        try {
            await this.documentService.assertCanUserAccess(req.params.id, req.user);
            const downloadUrl = await this.documentService.getDownloadUrl(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)({ downloadUrl }));
        }
        catch (err) {
            next(err);
        }
    }
    async _delete(req, res, next) {
        try {
            await this.documentService.delete(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Document deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listByEntity(req, res, next) {
        try {
            const documents = await this.documentService.listByEntityForActor(req.params.entityType, req.params.entityId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(documents));
        }
        catch (err) {
            next(err);
        }
    }
    async _list(req, res, next) {
        try {
            const { documents, meta } = await this.documentService.list(req.query, req.user.id);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(documents), meta });
        }
        catch (err) {
            next(err);
        }
    }
    async _serve(req, res, next) {
        try {
            const file = await this.documentService.serveFile(req.params.storedName, req.user);
            this._sendFile(res, file);
        }
        catch (err) {
            next(err);
        }
    }
    async _getFileById(req, res, next) {
        try {
            await this.documentService.assertCanUserAccess(req.params.id, req.user);
            const file = await this.documentService.getFileById(req.params.id);
            this._sendFile(res, file);
        }
        catch (err) {
            next(err);
        }
    }
    _sendFile(res, file) {
        // RFC 5987 encoding keeps non-ASCII filenames intact for browsers.
        const encodedName = encodeURIComponent(file.originalName);
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Length', file.fileSize);
        res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
        res.status(200).send(file.buffer);
    }
    // ──────────────────────────────────────────────────────────
    // Version handlers
    // ──────────────────────────────────────────────────────────
    async _uploadNewVersion(req, res, next) {
        try {
            if (!req.file) {
                throw app_error_1.AppError.badRequest('File is required (multipart field "file")');
            }
            const version = await this.documentService.uploadNewVersion(req.params.id, {
                uploadedById: req.user.id,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSize: req.file.size,
                buffer: req.file.buffer,
                changeNote: req.body.changeNote,
            });
            res.status(201).json((0, api_response_type_1.buildResponse)(version, 'New document version uploaded'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listVersions(req, res, next) {
        try {
            const versions = await this.documentService.listVersions(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(versions));
        }
        catch (err) {
            next(err);
        }
    }
    async _getVersion(req, res, next) {
        try {
            const versionNumber = Number(req.params.version);
            if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
                throw app_error_1.AppError.badRequest('Version must be a positive integer');
            }
            const version = await this.documentService.getVersion(req.params.id, versionNumber, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(version));
        }
        catch (err) {
            next(err);
        }
    }
    async _getVersionDownloadUrl(req, res, next) {
        try {
            const versionNumber = Number(req.params.version);
            if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
                throw app_error_1.AppError.badRequest('Version must be a positive integer');
            }
            const downloadUrl = await this.documentService.getVersionDownloadUrl(req.params.id, versionNumber, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)({ downloadUrl }));
        }
        catch (err) {
            next(err);
        }
    }
    // ──────────────────────────────────────────────────────────
    // Template handlers
    // ──────────────────────────────────────────────────────────
    async _createTemplate(req, res, next) {
        try {
            const template = await this.documentService.createTemplate(req.body, req.user.id);
            res.status(201).json((0, api_response_type_1.buildResponse)(template, 'Template created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listTemplates(req, res, next) {
        try {
            const { templates, meta } = await this.documentService.listTemplates(req.query);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(templates), meta });
        }
        catch (err) {
            next(err);
        }
    }
    async _getTemplateById(req, res, next) {
        try {
            const template = await this.documentService.getTemplateById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(template));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateTemplate(req, res, next) {
        try {
            const template = await this.documentService.updateTemplate(req.params.id, req.body, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(template, 'Template updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteTemplate(req, res, next) {
        try {
            await this.documentService.deleteTemplate(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Template deleted'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DocumentController = DocumentController;
//# sourceMappingURL=document.controller.js.map