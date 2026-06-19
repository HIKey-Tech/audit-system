"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const approval_request_dto_1 = require("../dto/request/approval.request.dto");
class ApprovalController {
    approvalService;
    router;
    constructor(approvalService) {
        this.approvalService = approvalService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /workflow/approvals/pending
         * @desc   Get approval inbox for current user
         * @access Private - audit:read
         */
        this.router.get('/pending', (0, auth_middleware_1.requirePermission)('approval:read'), (0, validate_middleware_1.validate)(approval_request_dto_1.PendingApprovalQuerySchema, 'query'), this._getPendingApprovals.bind(this));
        /**
         * @route  GET /workflow/approvals/entity/:type/:id
         * @desc   Get latest approval for an entity
         * @access Private - audit:read
         */
        this.router.get('/entity/:type/:id', (0, auth_middleware_1.requirePermission)('approval:read'), (0, validate_middleware_1.validate)(approval_request_dto_1.ApprovalEntityParamsSchema, 'params'), this._getApprovalByEntity.bind(this));
        /**
         * @route  GET /workflow/approvals/chain/:entityType/:entityId
         * @desc   Resolve an entity's approval chain to named people for display
         * @access Private - audit:read
         */
        this.router.get('/chain/:entityType/:entityId', (0, auth_middleware_1.requirePermission)('audit:read'), this._getChain.bind(this));
        /**
         * @route  GET /workflow/approvals/:id
         * @desc   Get workflow approval
         * @access Private - audit:read
         */
        this.router.get('/:id', (0, auth_middleware_1.requirePermission)('approval:read'), this._getApprovalById.bind(this));
        /**
         * @route  GET /workflow/approvals/:id/signed-documents
         * @desc   List frozen signed artifacts for a completed approval
         * @access Private - approval:read
         */
        this.router.get('/:id/signed-documents', (0, auth_middleware_1.requirePermission)('approval:read'), this._listSignedDocuments.bind(this));
        /**
         * @route  POST /workflow/approvals/:id/approve
         * @desc   Approve current workflow approval step
         * @access Private - audit:write
         */
        this.router.post('/:id/approve', (0, auth_middleware_1.requirePermission)('approval:approve'), (0, validate_middleware_1.validate)(approval_request_dto_1.ApprovalActionRequestSchema), this._approve.bind(this));
        /**
         * @route  POST /workflow/approvals/:id/reject
         * @desc   Reject current workflow approval step
         * @access Private - audit:write
         */
        this.router.post('/:id/reject', (0, auth_middleware_1.requirePermission)('approval:reject'), (0, validate_middleware_1.validate)(approval_request_dto_1.RejectApprovalRequestSchema), this._reject.bind(this));
        /**
         * @route  POST /workflow/approvals/:id/cancel
         * @desc   Cancel pending workflow approval
         * @access Private - audit:admin
         */
        this.router.post('/:id/cancel', (0, auth_middleware_1.requirePermission)('approval:cancel'), this._cancel.bind(this));
    }
    async _getPendingApprovals(req, res, next) {
        try {
            const { approvals, meta } = await this.approvalService.getPendingApprovalsForUser(req.user, req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(approvals, 'Pending approvals retrieved', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _getApprovalByEntity(req, res, next) {
        try {
            const approval = await this.approvalService.getApprovalByEntity(req.params.type, req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(approval));
        }
        catch (err) {
            next(err);
        }
    }
    async _getChain(req, res, next) {
        try {
            const { entityType, entityId } = req.params;
            const chain = await this.approvalService.resolveChainForEntity(entityType, entityId);
            res.status(200).json((0, api_response_type_1.buildResponse)(chain, 'Approval chain resolved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getApprovalById(req, res, next) {
        try {
            const approval = await this.approvalService.getApprovalById(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(approval));
        }
        catch (err) {
            next(err);
        }
    }
    async _listSignedDocuments(req, res, next) {
        try {
            const docs = await this.approvalService.listSignedDocuments(req.params.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(docs));
        }
        catch (err) {
            next(err);
        }
    }
    async _approve(req, res, next) {
        try {
            const approval = await this.approvalService.approve(req.params.id, req.user, req.body.comment);
            res.status(200).json((0, api_response_type_1.buildResponse)(approval, 'Approval step approved'));
        }
        catch (err) {
            next(err);
        }
    }
    async _reject(req, res, next) {
        try {
            const approval = await this.approvalService.reject(req.params.id, req.user, req.body.reason);
            res.status(200).json((0, api_response_type_1.buildResponse)(approval, 'Approval rejected'));
        }
        catch (err) {
            next(err);
        }
    }
    async _cancel(req, res, next) {
        try {
            const approval = await this.approvalService.cancelApproval(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(approval, 'Approval cancelled'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ApprovalController = ApprovalController;
//# sourceMappingURL=approval.controller.js.map