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
         * @access Private - audit:write
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('plan:create'), (0, validate_middleware_1.validate)(planning_request_dto_1.CreatePlanRequestSchema), this._createPlan.bind(this));
        /**
         * @route  GET /audit/plans
         * @desc   List audit plans
         * @access Private - audit:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('plan:read'), (0, validate_middleware_1.validate)(planning_request_dto_1.PlanQuerySchema, 'query'), this._listPlans.bind(this));
        /**
         * @route  GET /audit/plans/:id
         * @desc   Get audit plan
         * @access Private - audit:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('plan:read'), this._getPlanById.bind(this));
        /**
         * @route  PUT /audit/plans/:id
         * @desc   Update draft audit plan
         * @access Private - audit:write
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('plan:update'), (0, validate_middleware_1.validate)(planning_request_dto_1.UpdatePlanRequestSchema), this._updatePlan.bind(this));
        /**
         * @route  DELETE /audit/plans/:id
         * @desc   Delete draft audit plan
         * @access Private - audit:write
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('plan:update'), this._deletePlan.bind(this));
        /**
         * @route  POST /audit/plans/:id/items
         * @desc   Add audit plan item
         * @access Private - audit:write
         */
        this.router.post('/:id/items', (0, auth_middleware_1.requirePermission)('plan:add_item'), (0, validate_middleware_1.validate)(planning_request_dto_1.AddPlanItemRequestSchema), this._addPlanItem.bind(this));
        /**
         * @route  DELETE /audit/plans/:id/items/:itemId
         * @desc   Remove audit plan item
         * @access Private - audit:write
         */
        this.router.delete('/:id/items/:itemId', (0, auth_middleware_1.requirePermission)('plan:add_item'), this._removePlanItem.bind(this));
        /**
         * @route  POST /audit/plans/:id/submit
         * @desc   Submit plan for approval
         * @access Private - audit:write
         */
        this.router.post('/:id/submit', (0, auth_middleware_1.requirePermission)('plan:submit'), this._submitPlanForApproval.bind(this));
        /**
         * @route  POST /audit/plans/:id/approve
         * @desc   Approve audit plan
         * @access Private - audit:admin
         */
        this.router.post('/:id/approve', (0, auth_middleware_1.requirePermission)('plan:approve'), this._approvePlan.bind(this));
        /**
         * @route  POST /audit/plans/:id/reject
         * @desc   Reject audit plan
         * @access Private - audit:admin
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