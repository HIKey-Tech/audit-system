"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const assignment_request_dto_1 = require("../dto/request/assignment.request.dto");
class AssignmentController {
    assignmentService;
    router;
    constructor(assignmentService) {
        this.assignmentService = assignmentService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /workflow/assignments
         * @desc   Assign staff to an engagement
         * @access Private - audit:write
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('audit:write'), (0, validate_middleware_1.validate)(assignment_request_dto_1.AssignStaffRequestSchema), this._assignStaff.bind(this));
        /**
         * @route  GET /workflow/assignments/engagement/:id
         * @desc   Get engagement assignments
         * @access Private - audit:read
         */
        this.router.get('/engagement/:id', (0, auth_middleware_1.requirePermission)('audit:read'), this._getAssignments.bind(this));
        /**
         * @route  GET /workflow/assignments/mine
         * @desc   Get current user's assignments
         * @access Private - audit:read
         */
        this.router.get('/mine', (0, auth_middleware_1.requirePermission)('audit:read'), (0, validate_middleware_1.validate)(assignment_request_dto_1.MyAssignmentsQuerySchema, 'query'), this._getMyAssignments.bind(this));
        /**
         * @route  GET /workflow/assignments/workload/:userId
         * @desc   Get user workload
         * @access Private - audit:read
         */
        this.router.get('/workload/:userId', (0, auth_middleware_1.requirePermission)('audit:read'), this._getUserWorkload.bind(this));
        /**
         * @route  DELETE /workflow/assignments/:id
         * @desc   Remove assignment
         * @access Private - audit:write
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('audit:write'), this._removeAssignment.bind(this));
    }
    async _assignStaff(req, res, next) {
        try {
            const assignment = await this.assignmentService.assignStaff(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(assignment, 'Staff assigned'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getAssignments(req, res, next) {
        try {
            const assignments = await this.assignmentService.getAssignments(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(assignments));
        }
        catch (err) {
            next(err);
        }
    }
    async _getMyAssignments(req, res, next) {
        try {
            const { assignments, meta } = await this.assignmentService.getMyAssignments(req.user.id, req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(assignments, 'Assignments retrieved', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _getUserWorkload(req, res, next) {
        try {
            const workload = await this.assignmentService.getUserWorkload(req.params.userId);
            res.status(200).json((0, api_response_type_1.buildResponse)(workload));
        }
        catch (err) {
            next(err);
        }
    }
    async _removeAssignment(req, res, next) {
        try {
            await this.assignmentService.removeAssignment(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Assignment removed'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AssignmentController = AssignmentController;
//# sourceMappingURL=assignment.controller.js.map