"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const finding_request_dto_1 = require("../dto/request/finding.request.dto");
class FindingController {
    findingService;
    router;
    constructor(findingService) {
        this.findingService = findingService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/engagements/:id/findings
         * @desc   Create finding
         * @access Private - finding:write
         */
        this.router.post('/engagements/:id/findings', (0, auth_middleware_1.requirePermission)('finding:create'), (0, validate_middleware_1.validate)(finding_request_dto_1.CreateFindingRequestSchema), this._createFinding.bind(this));
        /**
         * @route  GET /audit/engagements/:id/findings
         * @desc   List findings
         * @access Private - finding:read
         */
        this.router.get('/engagements/:id/findings', (0, auth_middleware_1.requirePermission)('finding:read'), (0, validate_middleware_1.validate)(finding_request_dto_1.FindingQuerySchema, 'query'), this._listFindings.bind(this));
        /**
         * @route  GET /audit/findings/:id
         * @desc   Get finding
         * @access Private - finding:read
         */
        this.router.get('/findings/:id', (0, auth_middleware_1.requirePermission)('finding:read'), this._getFindingById.bind(this));
        /**
         * @route  PUT /audit/findings/:id
         * @desc   Update finding
         * @access Private - finding:write
         */
        this.router.put('/findings/:id', (0, auth_middleware_1.requirePermission)('finding:update'), (0, validate_middleware_1.validate)(finding_request_dto_1.UpdateFindingRequestSchema), this._updateFinding.bind(this));
        /**
         * @route  PATCH /audit/findings/:id/status
         * @desc   Update finding status
         * @access Private - finding:write
         */
        this.router.patch('/findings/:id/status', (0, auth_middleware_1.requirePermission)('finding:update'), (0, validate_middleware_1.validate)(finding_request_dto_1.UpdateFindingStatusRequestSchema), this._updateFindingStatus.bind(this));
        /**
         * @route  POST /audit/findings/:id/close
         * @desc   Close finding
         * @access Private - finding:write
         */
        this.router.post('/findings/:id/close', (0, auth_middleware_1.requirePermission)('finding:close'), this._closeFinding.bind(this));
    }
    async _createFinding(req, res, next) {
        try {
            const finding = await this.findingService.createFinding(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(finding, 'Finding created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateFinding(req, res, next) {
        try {
            const finding = await this.findingService.updateFinding(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(finding, 'Finding updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateFindingStatus(req, res, next) {
        try {
            const finding = await this.findingService.updateFindingStatus(req.params.id, req.body.status, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(finding, 'Finding status updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _closeFinding(req, res, next) {
        try {
            const finding = await this.findingService.closeFinding(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(finding, 'Finding closed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getFindingById(req, res, next) {
        try {
            const finding = await this.findingService.getFindingById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(finding));
        }
        catch (err) {
            next(err);
        }
    }
    async _listFindings(req, res, next) {
        try {
            const findings = await this.findingService.listFindings(req.params.id, req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(findings));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.FindingController = FindingController;
//# sourceMappingURL=finding.controller.js.map