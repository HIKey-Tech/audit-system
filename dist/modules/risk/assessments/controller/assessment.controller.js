"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssessmentController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const assessment_request_dto_1 = require("../dto/request/assessment.request.dto");
class AssessmentController {
    assessmentService;
    router;
    constructor(assessmentService) {
        this.assessmentService = assessmentService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /risk/register/:id/assessments
         * @desc   Create risk assessment
         * @access Private - audit:write
         */
        this.router.post('/register/:id/assessments', (0, auth_middleware_1.requirePermission)('audit:write'), (0, validate_middleware_1.validate)(assessment_request_dto_1.CreateRiskAssessmentRequestSchema), this._createAssessment.bind(this));
        /**
         * @route  GET /risk/register/:id/assessments
         * @desc   List assessments for a risk
         * @access Private - audit:read
         */
        this.router.get('/register/:id/assessments', (0, auth_middleware_1.requirePermission)('audit:read'), (0, validate_middleware_1.validate)(assessment_request_dto_1.RiskAssessmentQuerySchema, 'query'), this._listAssessments.bind(this));
        /**
         * @route  GET /risk/register/:id/assessments/latest
         * @desc   Get latest assessment for a risk
         * @access Private - audit:read
         */
        this.router.get('/register/:id/assessments/latest', (0, auth_middleware_1.requirePermission)('audit:read'), this._getLatestAssessment.bind(this));
        /**
         * @route  GET /risk/assessments/:id
         * @desc   Get risk assessment by ID
         * @access Private - audit:read
         */
        this.router.get('/assessments/:id', (0, auth_middleware_1.requirePermission)('audit:read'), this._getAssessmentById.bind(this));
    }
    async _createAssessment(req, res, next) {
        try {
            const assessment = await this.assessmentService.createAssessment(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(assessment, 'Risk assessment created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getAssessmentById(req, res, next) {
        try {
            const assessment = await this.assessmentService.getAssessmentById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(assessment));
        }
        catch (err) {
            next(err);
        }
    }
    async _listAssessments(req, res, next) {
        try {
            const { assessments, meta } = await this.assessmentService.listAssessments(req.params.id, req.query, req.user);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(assessments), meta });
        }
        catch (err) {
            next(err);
        }
    }
    async _getLatestAssessment(req, res, next) {
        try {
            const assessment = await this.assessmentService.getLatestAssessment(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(assessment));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AssessmentController = AssessmentController;
//# sourceMappingURL=assessment.controller.js.map