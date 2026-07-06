"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceRequestController = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const evidence_request_request_dto_1 = require("../dto/request/evidence-request.request.dto");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
class EvidenceRequestController {
    evidenceRequestService;
    router;
    constructor(evidenceRequestService) {
        this.evidenceRequestService = evidenceRequestService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/engagements/:id/evidence-requests
         * @desc   Ask the auditee for specific documents (PBC item)
         * @access Private - evidence:request
         */
        this.router.post('/engagements/:id/evidence-requests', (0, auth_middleware_1.requirePermission)('evidence:request'), (0, validate_middleware_1.validate)(evidence_request_request_dto_1.CreateEvidenceRequestSchema), this._create.bind(this));
        /**
         * @route  GET /audit/engagements/:id/evidence-requests
         * @desc   List evidence requests on an engagement (auditee sees only their own)
         * @access Private - authenticated; service scopes visibility
         */
        this.router.get('/engagements/:id/evidence-requests', this._listForEngagement.bind(this));
        /**
         * @route  GET /audit/evidence-requests/mine
         * @desc   Outstanding evidence requests assigned to the caller
         * @access Private - authenticated
         */
        this.router.get('/evidence-requests/mine', this._listMine.bind(this));
        /**
         * @route  POST /audit/evidence-requests/:id/respond
         * @desc   Upload a document against a request (assigned user only)
         * @access Private - authenticated; service enforces assignment
         */
        this.router.post('/evidence-requests/:id/respond', upload.single('file'), this._respond.bind(this));
        /**
         * @route  POST /audit/evidence-requests/:id/accept
         * @desc   Accept a submission and mark the request fulfilled
         * @access Private - evidence:request
         */
        this.router.post('/evidence-requests/:id/accept', (0, auth_middleware_1.requirePermission)('evidence:request'), this._accept.bind(this));
        /**
         * @route  POST /audit/evidence-requests/:id/return
         * @desc   Return a submission to the auditee with a reason
         * @access Private - evidence:request
         */
        this.router.post('/evidence-requests/:id/return', (0, auth_middleware_1.requirePermission)('evidence:request'), (0, validate_middleware_1.validate)(evidence_request_request_dto_1.ReturnEvidenceRequestSchema), this._return.bind(this));
        /**
         * @route  DELETE /audit/evidence-requests/:id
         * @desc   Cancel (soft-delete) an unfulfilled request
         * @access Private - evidence:request
         */
        this.router.delete('/evidence-requests/:id', (0, auth_middleware_1.requirePermission)('evidence:request'), this._cancel.bind(this));
    }
    async _create(req, res, next) {
        try {
            const request = await this.evidenceRequestService.createRequest(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(request, 'Evidence request created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listForEngagement(req, res, next) {
        try {
            const requests = await this.evidenceRequestService.listForEngagement(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(requests));
        }
        catch (err) {
            next(err);
        }
    }
    async _listMine(req, res, next) {
        try {
            const requests = await this.evidenceRequestService.listMine(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(requests));
        }
        catch (err) {
            next(err);
        }
    }
    async _respond(req, res, next) {
        try {
            if (!req.file)
                throw app_error_1.AppError.badRequest('File is required (multipart field "file")');
            const request = await this.evidenceRequestService.respond(req.params.id, {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSize: req.file.size,
                buffer: req.file.buffer,
            }, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(request, 'Evidence submitted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _accept(req, res, next) {
        try {
            const request = await this.evidenceRequestService.accept(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(request, 'Evidence request fulfilled'));
        }
        catch (err) {
            next(err);
        }
    }
    async _return(req, res, next) {
        try {
            const request = await this.evidenceRequestService.returnRequest(req.params.id, req.body.reason, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(request, 'Evidence request returned'));
        }
        catch (err) {
            next(err);
        }
    }
    async _cancel(req, res, next) {
        try {
            await this.evidenceRequestService.cancelRequest(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Evidence request cancelled'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.EvidenceRequestController = EvidenceRequestController;
//# sourceMappingURL=evidence-request.controller.js.map