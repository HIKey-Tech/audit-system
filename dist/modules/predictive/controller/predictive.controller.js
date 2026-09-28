"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictiveController = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const predictive_request_dto_1 = require("../dto/request/predictive.request.dto");
class PredictiveController {
    predictiveService;
    router;
    constructor(predictiveService) {
        this.predictiveService = predictiveService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route GET /predictive/overview
         * @desc Explainable live-data early warnings and role-scoped next actions
         * @access Private — predictive:read
         */
        this.router.get('/overview', (0, auth_middleware_1.requirePermission)('predictive:read'), this._getOverview.bind(this));
        /**
         * @route POST /predictive/insights/:id/feedback
         * @desc Record whether an insight was useful; creates live model-feedback data
         * @access Private — predictive:read and source-record visibility
         */
        this.router.post('/insights/:id/feedback', (0, auth_middleware_1.requirePermission)('predictive:read'), (0, validate_middleware_1.validate)(predictive_request_dto_1.InsightFeedbackSchema), this._recordFeedback.bind(this));
    }
    async _getOverview(req, res, next) {
        try {
            const overview = await this.predictiveService.getOverview(req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(overview));
        }
        catch (err) {
            next(err);
        }
    }
    async _recordFeedback(req, res, next) {
        try {
            await this.predictiveService.recordFeedback(req.params.id, req.body, req.user);
            res.status(200).json((0, api_response_type_1.buildResponse)(undefined, 'Insight feedback recorded'));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.PredictiveController = PredictiveController;
//# sourceMappingURL=predictive.controller.js.map