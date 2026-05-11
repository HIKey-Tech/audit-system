"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkingPaperController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const working_paper_request_dto_1 = require("../dto/request/working-paper.request.dto");
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
         * @access Private - audit:write
         */
        this.router.post('/engagements/:id/working-papers', (0, auth_middleware_1.requirePermission)('working_paper:create'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.CreateWorkingPaperRequestSchema), this._createWorkingPaper.bind(this));
        /**
         * @route  GET /audit/engagements/:id/working-papers
         * @desc   List working papers
         * @access Private - audit:read
         */
        this.router.get('/engagements/:id/working-papers', (0, auth_middleware_1.requirePermission)('working_paper:read'), this._listWorkingPapers.bind(this));
        /**
         * @route  GET /audit/working-papers/:id
         * @desc   Get working paper
         * @access Private - audit:read
         */
        this.router.get('/working-papers/:id', (0, auth_middleware_1.requirePermission)('working_paper:read'), this._getWorkingPaperById.bind(this));
        /**
         * @route  PUT /audit/working-papers/:id
         * @desc   Update working paper
         * @access Private - audit:write
         */
        this.router.put('/working-papers/:id', (0, auth_middleware_1.requirePermission)('working_paper:update'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.UpdateWorkingPaperRequestSchema), this._updateWorkingPaper.bind(this));
        /**
         * @route  POST /audit/working-papers/:id/submit
         * @desc   Submit working paper
         * @access Private - audit:write
         */
        this.router.post('/working-papers/:id/submit', (0, auth_middleware_1.requirePermission)('working_paper:submit'), this._submitWorkingPaper.bind(this));
        /**
         * @route  POST /audit/working-papers/:id/approve
         * @desc   Approve working paper
         * @access Private - audit:write
         */
        this.router.post('/working-papers/:id/approve', (0, auth_middleware_1.requirePermission)('working_paper:approve'), this._approveWorkingPaper.bind(this));
        /**
         * @route  POST /audit/working-papers/:id/reject
         * @desc   Reject working paper
         * @access Private - audit:write
         */
        this.router.post('/working-papers/:id/reject', (0, auth_middleware_1.requirePermission)('working_paper:reject'), (0, validate_middleware_1.validate)(working_paper_request_dto_1.RejectWorkingPaperRequestSchema), this._rejectWorkingPaper.bind(this));
        /**
         * @route  GET /audit/working-papers/:id/export
         * @desc   Export working paper
         * @access Private - audit:read
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
            const paper = await this.workingPaperService.approveWorkingPaper(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(paper, 'Working paper approved'));
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
            const paper = await this.workingPaperService.getWorkingPaperById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(paper));
        }
        catch (err) {
            next(err);
        }
    }
    async _listWorkingPapers(req, res, next) {
        try {
            const papers = await this.workingPaperService.listWorkingPapers(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(papers));
        }
        catch (err) {
            next(err);
        }
    }
    async _exportWorkingPaper(req, res, next) {
        try {
            const file = await this.workingPaperService.exportWorkingPaper(req.params.id);
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