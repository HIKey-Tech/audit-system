"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const engagement_request_dto_1 = require("../dto/request/engagement.request.dto");
class EngagementController {
    engagementService;
    router;
    constructor(engagementService) {
        this.engagementService = engagementService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/engagements
         * @desc   Create engagement from plan item
         * @access Private - audit:write
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('engagement:create'), (0, validate_middleware_1.validate)(engagement_request_dto_1.CreateEngagementFromPlanRequestSchema), this._createFromPlanItem.bind(this));
        /**
         * @route  POST /audit/engagements/adhoc
         * @desc   Create ad-hoc engagement
         * @access Private - audit:write
         */
        this.router.post('/adhoc', (0, auth_middleware_1.requirePermission)('engagement:create'), (0, validate_middleware_1.validate)(engagement_request_dto_1.CreateAdhocEngagementRequestSchema), this._createAdhoc.bind(this));
        /**
         * @route  GET /audit/engagements
         * @desc   List engagements
         * @access Private - audit:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('engagement:read'), (0, validate_middleware_1.validate)(engagement_request_dto_1.EngagementQuerySchema, 'query'), this._listEngagements.bind(this));
        /**
         * @route  GET /audit/engagements/:id
         * @desc   Get engagement
         * @access Private - audit:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('engagement:read'), this._getEngagementById.bind(this));
        /**
         * @route  PUT /audit/engagements/:id
         * @desc   Update engagement
         * @access Private - audit:write
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('engagement:update'), (0, validate_middleware_1.validate)(engagement_request_dto_1.UpdateEngagementRequestSchema), this._updateEngagement.bind(this));
        /**
         * @route  PATCH /audit/engagements/:id/status
         * @desc   Update engagement status
         * @access Private - audit:write
         */
        this.router.patch('/:id/status', (0, auth_middleware_1.requirePermission)('engagement:update'), (0, validate_middleware_1.validate)(engagement_request_dto_1.UpdateEngagementStatusRequestSchema), this._updateStatus.bind(this));
    }
    async _createFromPlanItem(req, res, next) {
        try {
            const engagement = await this.engagementService.createFromPlanItem(req.body.planItemId, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(engagement, 'Audit engagement created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _createAdhoc(req, res, next) {
        try {
            const engagement = await this.engagementService.createAdhoc(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(engagement, 'Ad-hoc audit engagement created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateEngagement(req, res, next) {
        try {
            const engagement = await this.engagementService.updateEngagement(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(engagement, 'Audit engagement updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateStatus(req, res, next) {
        try {
            const engagement = await this.engagementService.updateStatus(req.params.id, req.body.status, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(engagement, 'Audit engagement status updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getEngagementById(req, res, next) {
        try {
            const engagement = await this.engagementService.getEngagementById(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(engagement));
        }
        catch (err) {
            next(err);
        }
    }
    async _listEngagements(req, res, next) {
        try {
            const { engagements, meta } = await this.engagementService.listEngagements(req.query, req.user);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(engagements), meta });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.EngagementController = EngagementController;
//# sourceMappingURL=engagement.controller.js.map