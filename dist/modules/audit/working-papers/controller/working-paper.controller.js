"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkingPaperController = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const app_error_1 = require("../../../../shared/errors/app.error");
const working_paper_request_dto_1 = require("../dto/request/working-paper.request.dto");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});
class WorkingPaperController {
    workingPaperService;
    router;
    constructor(workingPaperService) {
        this.workingPaperService = workingPaperService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/engagements/:id/working-papers
         * @desc   Create working paper
         * @access Private - working_paper:create
         */
        this.router.post('/engagements/:id/working-papers', (0, auth_middleware_1.requirePermission)('working_paper:create'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.CreateWorkingPaperRequestSchema), this._createWorkingPaper.bind(this));
        /**
         * @route  POST /audit/engagements/:id/working-papers/import-preview
         * @desc   Upload and extract a working paper into a reviewable draft preview
         * @access Private - working_paper:create
         */
        this.router.post('/engagements/:id/working-papers/import-preview', (0, auth_middleware_1.requirePermission)('working_paper:create'), upload.single('file'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.ImportWorkingPaperMetadataSchema), this._previewWorkingPaperImport.bind(this));
        /**
         * @route  GET /audit/engagements/:id/working-papers
         * @desc   List working papers
         * @access Private - working_paper:read
         */
        this.router.get('/engagements/:id/working-papers', (0, auth_middleware_1.requirePermission)('working_paper:read'), this._listWorkingPapers.bind(this));
        /**
         * @route  GET /audit/working-papers/:id
         * @desc   Get working paper
         * @access Private - working_paper:read
         */
        this.router.get('/working-papers/:id', (0, auth_middleware_1.requirePermission)('working_paper:read'), this._getWorkingPaperById.bind(this));
        /**
         * @route  PUT /audit/working-papers/:id
         * @desc   Update working paper
         * @access Private - working_paper:update
         */
        this.router.put('/working-papers/:id', (0, auth_middleware_1.requirePermission)('working_paper:update'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.UpdateWorkingPaperRequestSchema), this._updateWorkingPaper.bind(this));
        /**
         * @route  POST /audit/working-papers/:id/submit
         * @desc   Submit working paper
         * @access Private - working_paper:submit
         */
        this.router.post('/working-papers/:id/submit', (0, auth_middleware_1.requirePermission)('working_paper:submit'), this._submitWorkingPaper.bind(this));
        /**
         * @route  POST /audit/working-papers/:id/approve
         * @desc   Approve working paper
         * @access Private - working_paper:approve
         */
        this.router.post('/working-papers/:id/approve', (0, auth_middleware_1.requirePermission)('working_paper:approve'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.ApproveWorkingPaperRequestSchema), this._approveWorkingPaper.bind(this));
        /**
         * @route  POST /audit/working-papers/:id/comments
         * @desc   Add a review comment (reviewer ↔ preparer back-and-forth)
         * @access Private - working_paper:read
         */
        this.router.post('/working-papers/:id/comments', (0, auth_middleware_1.requirePermission)('working_paper:read'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.AddWorkingPaperCommentSchema), this._addComment.bind(this));
        /**
         * @route  GET /audit/working-papers/:id/comments
         * @desc   List review comments on a working paper
         * @access Private - working_paper:read
         */
        this.router.get('/working-papers/:id/comments', (0, auth_middleware_1.requirePermission)('working_paper:read'), this._listComments.bind(this));
        /**
         * @route  POST /audit/working-papers/comments/:commentId/resolve
         * @desc   Mark a review comment as addressed
         * @access Private - working_paper:read (author/preparer/reviewer enforced in service)
         */
        this.router.post('/working-papers/comments/:commentId/resolve', (0, auth_middleware_1.requirePermission)('working_paper:read'), this._resolveComment.bind(this));
        /**
         * @route  POST /audit/working-papers/:id/reject
         * @desc   Reject working paper
         * @access Private - working_paper:reject
         */
        this.router.post('/working-papers/:id/reject', (0, auth_middleware_1.requirePermission)('working_paper:reject'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.RejectWorkingPaperRequestSchema), this._rejectWorkingPaper.bind(this));
        /**
         * @route  GET /audit/working-papers/:id/export?format=docx|pdf
         * @desc   Export an approved working paper as DOCX (default) or PDF
         * @access Private - working_paper:read
         */
        this.router.get('/working-papers/:id/export', (0, auth_middleware_1.requirePermission)('working_paper:read'), this._exportWorkingPaper.bind(this));
    }
    async _createWorkingPaper(req, res, next) {
        try {
            const paper = await this.workingPaperService.createWorkingPaper(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(paper, 'Working paper created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _previewWorkingPaperImport(req, res, next) {
        try {
            if (!req.file) {
                throw app_error_1.AppError.badRequest('File is required (multipart field "file")');
            }
            const preview = await this.workingPaperService.previewWorkingPaperImport(req.params.id, {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                fileSize: req.file.size,
                buffer: req.file.buffer,
            }, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(preview, 'Working paper import preview generated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateWorkingPaper(req, res, next) {
        try {
            const paper = await this.workingPaperService.updateWorkingPaper(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(paper, 'Working paper updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _submitWorkingPaper(req, res, next) {
        try {
            const paper = await this.workingPaperService.submitWorkingPaper(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(paper, 'Working paper submitted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _approveWorkingPaper(req, res, next) {
        try {
            const paper = await this.workingPaperService.approveWorkingPaper(req.params.id, req.user, req.body.edits);
            res.status(200).json((0, api_response_type_1.buildResponse)(paper, 'Working paper approved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _addComment(req, res, next) {
        try {
            const comment = await this.workingPaperService.addComment(req.params.id, req.body.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(comment, 'Comment added'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listComments(req, res, next) {
        try {
            const comments = await this.workingPaperService.listComments(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(comments));
        }
        catch (err) {
            next(err);
        }
    }
    async _resolveComment(req, res, next) {
        try {
            const comment = await this.workingPaperService.resolveComment(req.params.commentId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(comment, 'Comment resolved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _rejectWorkingPaper(req, res, next) {
        try {
            const paper = await this.workingPaperService.rejectWorkingPaper(req.params.id, req.body.reason, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(paper, 'Working paper rejected'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getWorkingPaperById(req, res, next) {
        try {
            const paper = await this.workingPaperService.getWorkingPaperById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(paper));
        }
        catch (err) {
            next(err);
        }
    }
    async _listWorkingPapers(req, res, next) {
        try {
            const papers = await this.workingPaperService.listWorkingPapers(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(papers));
        }
        catch (err) {
            next(err);
        }
    }
    async _exportWorkingPaper(req, res, next) {
        try {
            const requested = String(req.query.format ?? 'docx').toLowerCase();
            if (requested !== 'docx' && requested !== 'pdf') {
                throw app_error_1.AppError.badRequest("Query param 'format' must be 'docx' or 'pdf'");
            }
            const file = await this.workingPaperService.exportWorkingPaper(req.params.id, requested);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.WorkingPaperController = WorkingPaperController;
//# sourceMappingURL=working-paper.controller.js.map