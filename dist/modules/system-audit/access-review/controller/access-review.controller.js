"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessReviewController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const access_review_request_dto_1 = require("../dto/request/access-review.request.dto");
class AccessReviewController {
    accessReviewService;
    router;
    constructor(accessReviewService) {
        this.accessReviewService = accessReviewService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /system-audit/access-reviews/:runId/items
         * @desc   Accounts in a user access review, with their flags and decisions
         * @access Private - sysaudit:read
         */
        this.router.get('/:runId/items', (0, auth_middleware_1.requirePermission)('sysaudit:read'), (0, validate_middleware_1.validate)(access_review_request_dto_1.AccessItemListQuerySchema, 'query'), this._listItems.bind(this));
        /**
         * @route  GET /system-audit/access-reviews/:runId/items/export
         * @desc   Export the access review worksheet (accounts, access, decisions)
         * @access Private - sysaudit:read
         */
        this.router.get('/:runId/items/export', (0, auth_middleware_1.requirePermission)('sysaudit:read'), (0, validate_middleware_1.validate)(access_review_request_dto_1.AccessItemExportQuerySchema, 'query'), this._exportItems.bind(this));
        /**
         * @route  POST /system-audit/access-reviews/:runId/decisions
         * @desc   Record access decisions (appropriate / revoke / modify) for accounts
         * @access Private - sysaudit:review
         */
        this.router.post('/:runId/decisions', (0, auth_middleware_1.requirePermission)('sysaudit:review'), (0, validate_middleware_1.validate)(access_review_request_dto_1.DecideAccessItemsSchema), this._decide.bind(this));
    }
    async _listItems(req, res, next) {
        try {
            const { items, meta } = await this.accessReviewService.listItems(req.params.runId, req.query, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(items, 'Success', meta));
        }
        catch (err) {
            next(err);
        }
    }
    async _exportItems(req, res, next) {
        try {
            const { format } = req.query;
            const file = await this.accessReviewService.exportItems(req.params.runId, format, req.user);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
            res.status(200).send(file.buffer);
        }
        catch (err) {
            next(err);
        }
    }
    async _decide(req, res, next) {
        try {
            const result = await this.accessReviewService.decideItems(req.params.runId, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(result, 'Decisions recorded'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AccessReviewController = AccessReviewController;
//# sourceMappingURL=access-review.controller.js.map