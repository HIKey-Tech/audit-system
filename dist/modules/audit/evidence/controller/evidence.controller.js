"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceController = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const evidence_request_dto_1 = require("../dto/request/evidence.request.dto");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
class EvidenceController {
    evidenceService;
    router;
    constructor(evidenceService) {
        this.evidenceService = evidenceService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /audit/evidence
         * @desc   Centralized evidence repository — list all audit evidence across
         *         every engagement, with search, filters and pagination
         * @access Private - evidence:read
         */
        this.router.get('/evidence', (0, auth_middleware_1.requirePermission)('evidence:read'), (0, validate_middleware_1.validate)(evidence_request_dto_1.EvidenceRepositoryQuerySchema, 'query'), this._listRepository.bind(this));
        /**
         * @route  GET /audit/evidence/:id/download
         * @desc   Get a secure download URL for a single evidence item
         * @access Private - evidence:read
         */
        this.router.get('/evidence/:id/download', (0, auth_middleware_1.requirePermission)('evidence:read'), this._getDownloadUrl.bind(this));
        /**
         * @route  GET /audit/evidence/:id
         * @desc   Get a single evidence item with full repository context
         * @access Private - evidence:read
         */
        this.router.get('/evidence/:id', (0, auth_middleware_1.requirePermission)('evidence:read'), this._getRepositoryEvidence.bind(this));
        /**
         * @route  POST /audit/engagements/:id/evidence
         * @desc   Upload audit evidence
         * @access Private - audit:write
         */
        this.router.post('/engagements/:id/evidence', (0, auth_middleware_1.requirePermission)('evidence:upload'), upload.single('file'), (0, validate_middleware_1.validate)(evidence_request_dto_1.UploadEvidenceMetadataSchema), this._uploadEvidence.bind(this));
        /**
         * @route  GET /audit/engagements/:id/evidence
         * @desc   List audit evidence
         * @access Private - audit:read
         */
        this.router.get('/engagements/:id/evidence', (0, auth_middleware_1.requirePermission)('evidence:read'), (0, validate_middleware_1.validate)(evidence_request_dto_1.EvidenceQuerySchema, 'query'), this._listEvidence.bind(this));
        /**
         * @route  POST /audit/evidence/:id/link/working-paper/:wpId
         * @desc   Link evidence to working paper
         * @access Private - audit:write
         */
        this.router.post('/evidence/:id/link/working-paper/:wpId', (0, auth_middleware_1.requirePermission)('evidence:upload'), this._linkToWorkingPaper.bind(this));
        /**
         * @route  POST /audit/evidence/:id/link/finding/:findingId
         * @desc   Link evidence to finding
         * @access Private - audit:write
         */
        this.router.post('/evidence/:id/link/finding/:findingId', (0, auth_middleware_1.requirePermission)('evidence:upload'), this._linkToFinding.bind(this));
        /**
         * @route  POST /audit/evidence/:id/dispute
         * @desc   Dispute evidence
         * @access Private - audit:admin
         */
        this.router.post('/evidence/:id/dispute', (0, auth_middleware_1.requirePermission)('evidence:dispute'), (0, validate_middleware_1.validate)(evidence_request_dto_1.DisputeEvidenceRequestSchema), this._disputeEvidence.bind(this));
    }
    async _uploadEvidence(req, res, next) {
        try {
            if (!req.file)
                throw app_error_1.AppError.badRequest('File is required (multipart field "file")');
            const evidence = await this.evidenceService.uploadEvidence(req.params.id, {
                workingPaperId: req.body.workingPaperId,
                findingId: req.body.findingId,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSize: req.file.size,
                buffer: req.file.buffer,
            }, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(evidence, 'Evidence uploaded'));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkToWorkingPaper(req, res, next) {
        try {
            const evidence = await this.evidenceService.linkToWorkingPaper(req.params.id, req.params.wpId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(evidence, 'Evidence linked to working paper'));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkToFinding(req, res, next) {
        try {
            const evidence = await this.evidenceService.linkToFinding(req.params.id, req.params.findingId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(evidence, 'Evidence linked to finding'));
        }
        catch (err) {
            next(err);
        }
    }
    async _disputeEvidence(req, res, next) {
        try {
            const evidence = await this.evidenceService.disputeEvidence(req.params.id, req.body.reason, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(evidence, 'Evidence disputed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listEvidence(req, res, next) {
        try {
            const evidence = await this.evidenceService.listEvidence(req.params.id, req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(evidence));
        }
        catch (err) {
            next(err);
        }
    }
    async _listRepository(req, res, next) {
        try {
            const { evidence, meta } = await this.evidenceService.listRepository(req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(evidence, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRepositoryEvidence(req, res, next) {
        try {
            const evidence = await this.evidenceService.getRepositoryEvidence(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(evidence));
        }
        catch (err) {
            next(err);
        }
    }
    async _getDownloadUrl(req, res, next) {
        try {
            const downloadUrl = await this.evidenceService.getDownloadUrl(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)({ downloadUrl }));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.EvidenceController = EvidenceController;
//# sourceMappingURL=evidence.controller.js.map