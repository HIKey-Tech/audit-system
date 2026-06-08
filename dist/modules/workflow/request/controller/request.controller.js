"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestController = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const app_error_1 = require("../../../../shared/errors/app.error");
const request_request_dto_1 = require("../dto/request/request.request.dto");
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });
class RequestController {
    requestService;
    router;
    constructor(requestService) {
        this.requestService = requestService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /workflow/requests/candidates
         * @desc   Eligible recipients (active users with request:receive)
         * @access Private - request:create
         */
        this.router.get('/candidates', (0, auth_middleware_1.requirePermission)('request:create'), this._getCandidates.bind(this));
        /**
         * @route  GET /workflow/requests/inbox
         * @desc   Requests where the caller is the current recipient
         * @access Private - request:read
         */
        this.router.get('/inbox', (0, auth_middleware_1.requirePermission)('request:read'), (0, validate_middleware_1.validate)(request_request_dto_1.RequestInboxQuerySchema, 'query'), this._inbox.bind(this));
        /**
         * @route  GET /workflow/requests
         * @desc   List requests the caller initiated or received
         * @access Private - request:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('request:read'), (0, validate_middleware_1.validate)(request_request_dto_1.RequestListQuerySchema, 'query'), this._list.bind(this));
        /**
         * @route  POST /workflow/requests
         * @desc   Initiate an ad-hoc request with an ordered recipient chain
         * @access Private - request:create
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('request:create'), (0, validate_middleware_1.validate)(request_request_dto_1.CreateRequestSchema), this._create.bind(this));
        /**
         * @route  POST /workflow/requests/:id/attachments
         * @desc   Attach a file/image (initiator only, before first action)
         * @access Private - request:create
         */
        this.router.post('/:id/attachments', (0, auth_middleware_1.requirePermission)('request:create'), upload.single('file'), this._addAttachment.bind(this));
        /**
         * @route  GET /workflow/requests/:id
         * @desc   Request detail (steps, action ledger, attachments)
         * @access Private - request:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('request:read'), this._getById.bind(this));
        /**
         * @route  GET /workflow/requests/:id/verify-signatures
         * @desc   Recompute signature hashes and report tamper status
         * @access Private - request:read
         */
        this.router.get('/:id/verify-signatures', (0, auth_middleware_1.requirePermission)('request:read'), this._verifySignatures.bind(this));
        /**
         * @route  POST /workflow/requests/:id/approve
         * @access Private - request:act
         */
        this.router.post('/:id/approve', (0, auth_middleware_1.requirePermission)('request:act'), (0, validate_middleware_1.validate)(request_request_dto_1.ApproveRequestSchema), this._approve.bind(this));
        /**
         * @route  POST /workflow/requests/:id/sign
         * @access Private - request:act
         */
        this.router.post('/:id/sign', (0, auth_middleware_1.requirePermission)('request:act'), (0, validate_middleware_1.validate)(request_request_dto_1.SignRequestSchema), this._sign.bind(this));
        /**
         * @route  POST /workflow/requests/:id/reject
         * @access Private - request:act
         */
        this.router.post('/:id/reject', (0, auth_middleware_1.requirePermission)('request:act'), (0, validate_middleware_1.validate)(request_request_dto_1.RejectRequestSchema), this._reject.bind(this));
        /**
         * @route  POST /workflow/requests/:id/comment
         * @access Private - request:act
         */
        this.router.post('/:id/comment', (0, auth_middleware_1.requirePermission)('request:act'), (0, validate_middleware_1.validate)(request_request_dto_1.CommentRequestSchema), this._comment.bind(this));
        /**
         * @route  POST /workflow/requests/:id/cancel
         * @access Private - request:create (initiator) or request:admin
         */
        this.router.post('/:id/cancel', (0, auth_middleware_1.requirePermission)('request:create'), this._cancel.bind(this));
    }
    async _getCandidates(req, res, next) {
        try {
            const candidates = await this.requestService.getCandidates(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(candidates, 'Eligible recipients retrieved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _inbox(req, res, next) {
        try {
            const { requests, meta } = await this.requestService.inbox(req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(requests, 'Request inbox retrieved', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _list(req, res, next) {
        try {
            const { requests, meta } = await this.requestService.list(req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(requests, 'Requests retrieved', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _create(req, res, next) {
        try {
            const request = await this.requestService.createRequest(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(request, 'Request created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _addAttachment(req, res, next) {
        try {
            if (!req.file)
                throw app_error_1.AppError.badRequest('File is required (multipart field "file")');
            const attachment = await this.requestService.addAttachment(req.params.id, {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSize: req.file.size,
                buffer: req.file.buffer,
            }, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(attachment, 'Attachment added'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getById(req, res, next) {
        try {
            const request = await this.requestService.getById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(request));
        }
        catch (err) {
            next(err);
        }
    }
    async _verifySignatures(req, res, next) {
        try {
            const result = await this.requestService.verifySignatures(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(result, 'Signature verification complete'));
        }
        catch (err) {
            next(err);
        }
    }
    async _approve(req, res, next) {
        try {
            const request = await this.requestService.approve(req.params.id, req.user, req.body);
            res.status(200).json((0, api_response_type_1.buildResponse)(request, 'Request approved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _sign(req, res, next) {
        try {
            const request = await this.requestService.sign(req.params.id, req.user, req.body);
            res.status(200).json((0, api_response_type_1.buildResponse)(request, 'Request signed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _reject(req, res, next) {
        try {
            const request = await this.requestService.reject(req.params.id, req.user, req.body);
            res.status(200).json((0, api_response_type_1.buildResponse)(request, 'Request rejected'));
        }
        catch (err) {
            next(err);
        }
    }
    async _comment(req, res, next) {
        try {
            const request = await this.requestService.comment(req.params.id, req.user, req.body);
            res.status(200).json((0, api_response_type_1.buildResponse)(request, 'Comment added'));
        }
        catch (err) {
            next(err);
        }
    }
    async _cancel(req, res, next) {
        try {
            const request = await this.requestService.cancel(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(request, 'Request cancelled'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.RequestController = RequestController;
//# sourceMappingURL=request.controller.js.map