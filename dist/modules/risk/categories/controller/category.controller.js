"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const category_request_dto_1 = require("../dto/request/category.request.dto");
class CategoryController {
    categoryService;
    router;
    constructor(categoryService) {
        this.categoryService = categoryService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  POST /risk/categories
         * @desc   Create risk category
         * @access Private - audit:write
         */
        this.router.post('/', (0, auth_middleware_1.requirePermission)('risk_category:write'), (0, validate_middleware_1.validate)(category_request_dto_1.CreateRiskCategoryRequestSchema), this._createCategory.bind(this));
        /**
         * @route  GET /risk/categories
         * @desc   List risk categories
         * @access Private - audit:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('risk_category:read'), (0, validate_middleware_1.validate)(category_request_dto_1.RiskCategoryQuerySchema, 'query'), this._listCategories.bind(this));
        /**
         * @route  PUT /risk/categories/:id
         * @desc   Update risk category
         * @access Private - audit:write
         */
        this.router.put('/:id', (0, auth_middleware_1.requirePermission)('risk_category:write'), (0, validate_middleware_1.validate)(category_request_dto_1.UpdateRiskCategoryRequestSchema), this._updateCategory.bind(this));
        /**
         * @route  DELETE /risk/categories/:id
         * @desc   Deactivate risk category
         * @access Private - audit:write
         */
        this.router.delete('/:id', (0, auth_middleware_1.requirePermission)('risk_category:delete'), this._deactivateCategory.bind(this));
    }
    async _createCategory(req, res, next) {
        try {
            const category = await this.categoryService.createCategory(req.body, req.user);
            res.status(201).json((0, api_response_type_1.buildResponse)(category, 'Risk category created'));
        }
        catch (err) {
            next(err);
        }
    }
    async _updateCategory(req, res, next) {
        try {
            const category = await this.categoryService.updateCategory(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(category, 'Risk category updated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _deactivateCategory(req, res, next) {
        try {
            await this.categoryService.deactivateCategory(req.params.id, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Risk category deactivated'));
        }
        catch (err) {
            next(err);
        }
    }
    async _listCategories(req, res, next) {
        try {
            const categories = await this.categoryService.listCategories(req.query);
            res.status(200).json((0, api_response_type_1.buildResponse)(categories));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.CategoryController = CategoryController;
//# sourceMappingURL=category.controller.js.map