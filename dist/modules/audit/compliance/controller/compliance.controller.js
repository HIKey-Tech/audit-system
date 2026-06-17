"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const compliance_request_dto_1 = require("../dto/request/compliance.request.dto");
class ComplianceController {
    complianceService;
    router;
    constructor(complianceService) {
        this.complianceService = complianceService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /audit/compliance/coverage
         * @desc   Per-framework control coverage summary
         * @access Private - control:read
         */
        this.router.get('/compliance/coverage', (0, auth_middleware_1.requirePermission)('control:read'), this._getCoverage.bind(this));
        /**
         * @route  GET /audit/compliance/tested-coverage
         * @desc   Per-framework assurance coverage — controls exercised, pass/fail
         * @access Private - control:read
         */
        this.router.get('/compliance/tested-coverage', (0, auth_middleware_1.requirePermission)('control:read'), this._getTestedCoverage.bind(this));
        /**
         * @route  GET /audit/compliance/risk-coverage
         * @desc   Per-risk control coverage — mapped & tested controls per register risk
         * @access Private - control:read
         */
        this.router.get('/compliance/risk-coverage', (0, auth_middleware_1.requirePermission)('control:read'), this._getRiskCoverage.bind(this));
        /**
         * @route  GET /audit/compliance/controls/:id/risks
         * @desc   List risks a control is mapped to
         * @access Private - control:read
         */
        this.router.get('/compliance/controls/:id/risks', (0, auth_middleware_1.requirePermission)('control:read'), this._listControlRisks.bind(this));
        /**
         * @route  POST /audit/compliance/controls/:id/risks
         * @desc   Map a control to a risk it mitigates
         * @access Private - control:manage
         */
        this.router.post('/compliance/controls/:id/risks', (0, auth_middleware_1.requirePermission)('control:manage'), (0, validate_middleware_1.validate)(compliance_request_dto_1.LinkRiskRequestSchema), this._linkRisk.bind(this));
        /**
         * @route  DELETE /audit/compliance/controls/:id/risks/:riskId
         * @desc   Remove a control–risk mapping
         * @access Private - control:manage
         */
        this.router.delete('/compliance/controls/:id/risks/:riskId', (0, auth_middleware_1.requirePermission)('control:manage'), this._unlinkRisk.bind(this));
        /**
         * @route  GET /audit/compliance/frameworks
         * @desc   List compliance frameworks
         * @access Private - control:read
         */
        this.router.get('/compliance/frameworks', (0, auth_middleware_1.requirePermission)('control:read'), this._listFrameworks.bind(this));
        /**
         * @route  POST /audit/compliance/frameworks
         * @desc   Create a compliance framework
         * @access Private - control:manage
         */
        this.router.post('/compliance/frameworks', (0, auth_middleware_1.requirePermission)('control:manage'), (0, validate_middleware_1.validate)(compliance_request_dto_1.CreateFrameworkRequestSchema), this._createFramework.bind(this));
        /**
         * @route  PUT /audit/compliance/frameworks/:id
         * @desc   Update a compliance framework
         * @access Private - control:manage
         */
        this.router.put('/compliance/frameworks/:id', (0, auth_middleware_1.requirePermission)('control:manage'), (0, validate_middleware_1.validate)(compliance_request_dto_1.UpdateFrameworkRequestSchema), this._updateFramework.bind(this));
        /**
         * @route  GET /audit/compliance/controls
         * @desc   List compliance controls
         * @access Private - control:read
         */
        this.router.get('/compliance/controls', (0, auth_middleware_1.requirePermission)('control:read'), (0, validate_middleware_1.validate)(compliance_request_dto_1.ControlQuerySchema, 'query'), this._listControls.bind(this));
        /**
         * @route  POST /audit/compliance/controls
         * @desc   Create a compliance control
         * @access Private - control:manage
         */
        this.router.post('/compliance/controls', (0, auth_middleware_1.requirePermission)('control:manage'), (0, validate_middleware_1.validate)(compliance_request_dto_1.CreateControlRequestSchema), this._createControl.bind(this));
        /**
         * @route  PUT /audit/compliance/controls/:id
         * @desc   Update a compliance control
         * @access Private - control:manage
         */
        this.router.put('/compliance/controls/:id', (0, auth_middleware_1.requirePermission)('control:manage'), (0, validate_middleware_1.validate)(compliance_request_dto_1.UpdateControlRequestSchema), this._updateControl.bind(this));
        /**
         * @route  DELETE /audit/compliance/controls/:id
         * @desc   Retire (soft-delete) a compliance control
         * @access Private - control:manage
         */
        this.router.delete('/compliance/controls/:id', (0, auth_middleware_1.requirePermission)('control:manage'), this._deleteControl.bind(this));
    }
    async _getCoverage(_req, res, next) {
        try {
            const coverage = await this.complianceService.getCoverage();
            res.status(200).json((0, api_response_type_1.buildResponse)(coverage));
        }
        catch (err) {
            next(err);
        }
    }
    async _getTestedCoverage(_req, res, next) {
        try {
            const coverage = await this.complianceService.getTestedCoverage();
            res.status(200).json((0, api_response_type_1.buildResponse)(coverage));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRiskCoverage(_req, res, next) {
        try {
            const coverage = await this.complianceService.getRiskCoverage();
            res.status(200).json((0, api_response_type_1.buildResponse)(coverage));
        }
        catch (err) {
            next(err);
        }
    }
    async _listControlRisks(req, res, next) {
        try {
            const risks = await this.complianceService.listControlRisks(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(risks));
        }
        catch (err) {
            next(err);
        }
    }
    async _linkRisk(req, res, next) {
        try {
            const risks = await this.complianceService.linkRisk(req.params.id, req.body.riskId, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(risks, 'Risk mapped to control'));
        }
        catch (err) {
            next(err);
        }
    }
    async _unlinkRisk(req, res, next) {
        try {
            await this.complianceService.unlinkRisk(req.params.id, req.params.riskId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Risk mapping removed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listFrameworks(_req, res, next) {
        try {
            const frameworks = await this.complianceService.listFrameworks();
            res.status(200).json((0, api_response_type_1.buildResponse)(frameworks));
        }
        catch (err) {
            next(err);
        }
    }
    async _createFramework(req, res, next) {
        try {
            const framework = await this.complianceService.createFramework(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(framework, 'Compliance framework created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateFramework(req, res, next) {
        try {
            const framework = await this.complianceService.updateFramework(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(framework, 'Compliance framework updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listControls(req, res, next) {
        try {
            const result = await this.complianceService.listControls(req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(result.controls, 'Success', result.meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _createControl(req, res, next) {
        try {
            const control = await this.complianceService.createControl(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(control, 'Compliance control created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateControl(req, res, next) {
        try {
            const control = await this.complianceService.updateControl(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(control, 'Compliance control updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteControl(req, res, next) {
        try {
            await this.complianceService.deleteControl(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Compliance control retired'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ComplianceController = ComplianceController;
//# sourceMappingURL=compliance.controller.js.map