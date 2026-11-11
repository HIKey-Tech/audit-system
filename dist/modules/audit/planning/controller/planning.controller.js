"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const planning_request_dto_1 = require("../dto/request/planning.request.dto");
class PlanningController {
    planningService;
    router;
    constructor(planningService) {
        this.planningService = planningService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /audit/plans
         * @desc   Create annual audit plan
         * @access Private - plan:create
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('plan:create'), (0, validate_middleware_1.validate)(planning_request_dto_1.CreatePlanRequestSchema), this._createPlan.bind(this));
        /**
         * @route  GET /audit/plans
         * @desc   List audit plans
         * @access Private - plan:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('plan:read'), (0, validate_middleware_1.validate)(planning_request_dto_1.PlanQuerySchema, 'query'), this._listPlans.bind(this));
        /**
         * @route  GET /audit/plans/recommendations
         * @desc   Composite audit-priority ranking of universe entities (risk score,
         *         open findings, audit overdue, never audited, time since last audit)
         *         with configurable weights — registered before /:id
         * @access Private - plan:read
         */
        this.router.get('/recommendations', (0, auth_middleware_1.requirePermission)('plan:read'), this._getRecommendations.bind(this));
        /**
         * @route  GET /audit/plans/:id/universe-candidates
         * @desc   List active universe entities with due-cycle classification & coverage for this programme year
         * @access Private - plan:read
         */
        this.router.get('/:id/universe-candidates', (0, auth_middleware_1.requirePermission)('plan:read'), this._getUniverseCandidates.bind(this));
        /**
         * @route  GET /audit/plans/:id
         * @desc   Get audit plan
         * @access Private - plan:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('plan:read'), this._getPlanById.bind(this));
        /**
         * @route  PUT /audit/plans/:id
         * @desc   Update draft audit plan
         * @access Private - plan:update
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('plan:update'), (0, validate_middleware_1.validate)(planning_request_dto_1.UpdatePlanRequestSchema), this._updatePlan.bind(this));
        /**
         * @route  DELETE /audit/plans/:id
         * @desc   Delete draft audit plan
         * @access Private - plan:update
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('plan:update'), this._deletePlan.bind(this));
        /**
         * @route  POST /audit/plans/:id/items/bulk
         * @desc   Bulk-import multiple universe entities into a draft/rejected audit plan
         * @access Private - plan:add_item
         */
        this.router.post('/:id/items/bulk', (0, auth_middleware_1.requirePermission)('plan:add_item'), (0, validate_middleware_1.validate)(planning_request_dto_1.BulkAddPlanItemsRequestSchema), this._bulkAddPlanItems.bind(this));
        /**
         * @route  POST /audit/plans/:id/items
         * @desc   Add audit plan item
         * @access Private - plan:add_item
         */
        this.router.post('/:id/items', (0, auth_middleware_1.requirePermission)('plan:add_item'), (0, validate_middleware_1.validate)(planning_request_dto_1.AddPlanItemRequestSchema), this._addPlanItem.bind(this));
        /**
         * @route  PUT /audit/plans/:id/items/:itemId
         * @desc   Update audit plan item
         * @access Private - plan:add_item
         */
        this.router.put('/:id/items/:itemId', (0, auth_middleware_1.requirePermission)('plan:add_item'), (0, validate_middleware_1.validate)(planning_request_dto_1.UpdatePlanItemRequestSchema), this._updatePlanItem.bind(this));
        /**
         * @route  DELETE /audit/plans/:id/items/:itemId
         * @desc   Remove audit plan item
         * @access Private - plan:add_item
         */
        this.router.delete('/:id/items/:itemId', (0, auth_middleware_1.requirePermission)('plan:add_item'), this._removePlanItem.bind(this));
        /**
         * @route  POST /audit/plans/:id/submit
         * @desc   Submit plan for approval
         * @access Private - plan:submit
         */
        this.router.post('/:id/submit', (0, auth_middleware_1.requirePermission)('plan:submit'), this._submitPlanForApproval.bind(this));
        /**
         * @route  POST /audit/plans/:id/approve
         * @desc   Approve audit plan
         * @access Private - plan:approve
         */
        this.router.post('/:id/approve', (0, auth_middleware_1.requirePermission)('plan:approve'), this._approvePlan.bind(this));
        /**
         * @route  POST /audit/plans/:id/reject
         * @desc   Reject audit plan
         * @access Private - plan:reject
         */
        this.router.post('/:id/reject', (0, auth_middleware_1.requirePermission)('plan:reject'), (0, validate_middleware_1.validate)(planning_request_dto_1.RejectPlanRequestSchema), this._rejectPlan.bind(this));
    }
    async _createPlan(req, res, next) {
        try {
            const plan = await this.planningService.createPlan(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(plan, 'Audit plan created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _addPlanItem(req, res, next) {
        try {
            const plan = await this.planningService.addPlanItem(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(plan, 'Audit plan item added'));
        }
        catch (err) {
            next(err);
        }
    }
    async _bulkAddPlanItems(req, res, next) {
        try {
            const plan = await this.planningService.bulkAddPlanItems(req.params.id, req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(plan, 'Audit plan items added'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updatePlanItem(req, res, next) {
        try {
            const plan = await this.planningService.updatePlanItem(req.params.id, req.params.itemId, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(plan, 'Audit plan item updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updatePlan(req, res, next) {
        try {
            const plan = await this.planningService.updatePlan(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(plan, 'Audit plan updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deletePlan(req, res, next) {
        try {
            await this.planningService.deletePlan(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Audit plan deleted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _removePlanItem(req, res, next) {
        try {
            await this.planningService.removePlanItem(req.params.id, req.params.itemId, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Audit plan item removed'));
        }
        catch (err) {
            next(err);
        }
    }
    async _submitPlanForApproval(req, res, next) {
        try {
            const plan = await this.planningService.submitPlanForApproval(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(plan, 'Audit plan submitted'));
        }
        catch (err) {
            next(err);
        }
    }
    async _approvePlan(req, res, next) {
        try {
            const plan = await this.planningService.approvePlan(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(plan, 'Audit plan approved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _rejectPlan(req, res, next) {
        try {
            const plan = await this.planningService.rejectPlan(req.params.id, req.body.reason, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(plan, 'Audit plan rejected'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getPlanById(req, res, next) {
        try {
            const plan = await this.planningService.getPlanById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(plan));
        }
        catch (err) {
            next(err);
        }
    }
    async _getUniverseCandidates(req, res, next) {
        try {
            const candidates = await this.planningService.getUniverseCandidates(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(candidates));
        }
        catch (err) {
            next(err);
        }
    }
    async _getRecommendations(_req, res, next) {
        try {
            const recommendations = await this.planningService.getRecommendations();
            res.status(200).json((0, api_response_type_1.buildResponse)(recommendations));
        }
        catch (err) {
            next(err);
        }
    }
    async _listPlans(req, res, next) {
        try {
            const { plans, meta } = await this.planningService.listPlans(req.query);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(plans), meta });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.PlanningController = PlanningController;
//# sourceMappingURL=planning.controller.js.map