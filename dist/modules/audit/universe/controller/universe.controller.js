"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniverseController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const universe_request_dto_1 = require("../dto/request/universe.request.dto");
class UniverseController {
    universeService;
    router;
    constructor(universeService) {
        this.universeService = universeService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/universe
         * @desc   Create audit universe entity
         * @access Private - audit:write
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('universe:create'), (0, validate_middleware_1.validate)(universe_request_dto_1.CreateUniverseRequestSchema), this._createEntity.bind(this));
        /**
         * @route  GET /audit/universe
         * @desc   List audit universe entities
         * @access Private - audit:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('universe:read'), (0, validate_middleware_1.validate)(universe_request_dto_1.UniverseQuerySchema, 'query'), this._listEntities.bind(this));
        /**
         * @route  GET /audit/universe/:id
         * @desc   Get audit universe entity
         * @access Private - audit:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('universe:read'), this._getEntityById.bind(this));
        /**
         * @route  PUT /audit/universe/:id
         * @desc   Update audit universe entity
         * @access Private - audit:write
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('universe:update'), (0, validate_middleware_1.validate)(universe_request_dto_1.UpdateUniverseRequestSchema), this._updateEntity.bind(this));
        /**
         * @route  DELETE /audit/universe/:id
         * @desc   Deactivate audit universe entity
         * @access Private - audit:delete
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('universe:delete'), this._deactivateEntity.bind(this));
    }
    async _createEntity(req, res, next) {
        try {
            const entity = await this.universeService.createEntity(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(entity, 'Audit universe entity created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateEntity(req, res, next) {
        try {
            const entity = await this.universeService.updateEntity(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(entity, 'Audit universe entity updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deactivateEntity(req, res, next) {
        try {
            await this.universeService.deactivateEntity(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Audit universe entity deactivated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getEntityById(req, res, next) {
        try {
            const entity = await this.universeService.getEntityById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(entity));
        }
        catch (err) {
            next(err);
        }
    }
    async _listEntities(req, res, next) {
        try {
            const { entities, meta } = await this.universeService.listEntities(req.query);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(entities), meta });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.UniverseController = UniverseController;
//# sourceMappingURL=universe.controller.js.map