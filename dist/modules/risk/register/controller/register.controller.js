"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const register_request_dto_1 = require("../dto/request/register.request.dto");
class RegisterController {
    registerService;
    router;
    constructor(registerService) {
        this.registerService = registerService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /risk/register
         * @desc   Create risk register item
         * @access Private - audit:write
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('audit:write'), (0, validate_middleware_1.validate)(register_request_dto_1.CreateRiskRequestSchema), this._createRisk.bind(this));
        /**
         * @route  GET /risk/register
         * @desc   List risk register items
         * @access Private - audit:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('audit:read'), (0, validate_middleware_1.validate)(register_request_dto_1.RiskRegisterQuerySchema, 'query'), this._listRisks.bind(this));
        /**
         * @route  GET /risk/register/universe/:universeId
         * @desc   List risks linked to audit universe entity
         * @access Private - audit:read
         */
        this.router.get('/universe/:universeId', (0, auth_middleware_1.requirePermission)('audit:read'), this._getRisksByUniverseEntity.bind(this));
        /**
         * @route  GET /risk/register/:id
         * @desc   Get risk register item
         * @access Private - audit:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('audit:read'), this._getRiskById.bind(this));
        /**
         * @route  PUT /risk/register/:id
         * @desc   Update risk register item
         * @access Private - audit:write
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('audit:write'), (0, validate_middleware_1.validate)(register_request_dto_1.UpdateRiskRequestSchema), this._updateRisk.bind(this));
        /**
         * @route  PATCH /risk/register/:id/status
         * @desc   Update risk status
         * @access Private - audit:write
         */
        this.router.patch('/:id/status', (0, auth_middleware_1.requirePermission)('audit:write'), (0, validate_middleware_1.validate)(register_request_dto_1.UpdateRiskStatusRequestSchema), this._updateRiskStatus.bind(this));
        /**
         * @route  DELETE /risk/register/:id
         * @desc   Soft-delete risk
         * @access Private - audit:delete
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('audit:delete'), this._deleteRisk.bind(this));
    }
    async _createRisk(req, res, next) {
        try {
            const risk = await this.registerService.createRisk(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(risk, 'Risk created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateRisk(req, res, next) {
        try {
            const risk = await this.registerService.updateRisk(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(risk, 'Risk updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateRiskStatus(req, res, next) {
        try {
            const risk = await this.registerService.updateRiskStatus(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(risk, 'Risk status updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deleteRisk(req, res, next) {
        try {
            await this.registerService.deleteRisk(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Risk deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRiskById(req, res, next) {
        try {
            const risk = await this.registerService.getRiskById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(risk));
        }
        catch (err) {
            next(err);
        }
    }
    async _listRisks(req, res, next) {
        try {
            const { risks, meta } = await this.registerService.listRisks(req.query, req.user);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(risks), meta });
        }
        catch (err) {
            next(err);
        }
    }
    async _getRisksByUniverseEntity(req, res, next) {
        try {
            const risks = await this.registerService.getRisksByUniverseEntity(req.params.universeId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(risks));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.RegisterController = RegisterController;
//# sourceMappingURL=register.controller.js.map