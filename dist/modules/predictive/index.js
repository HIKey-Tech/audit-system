"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictiveService = exports.createPredictiveModule = exports.predictiveService = void 0;
const express_1 = require("express");
const predictive_controller_1 = require("./controller/predictive.controller");
const warehouse_service_1 = require("../warehouse/service/implementation/warehouse.service");
const predictive_service_1 = require("./service/implementation/predictive.service");
// The predictive module only consumes warehouse-service methods. It does not
// query audit/workflow tables directly, preserving the modular-monolith
// boundary as the prediction engine grows.
exports.predictiveService = new predictive_service_1.PredictiveService(warehouse_service_1.warehouseService);
const createPredictiveModule = () => {
    const router = (0, express_1.Router)();
    const predictiveController = new predictive_controller_1.PredictiveController(exports.predictiveService);
    router.use('/predictive', predictiveController.router);
    return router;
};
exports.createPredictiveModule = createPredictiveModule;
var predictive_service_2 = require("./service/implementation/predictive.service");
Object.defineProperty(exports, "PredictiveService", { enumerable: true, get: function () { return predictive_service_2.PredictiveService; } });
//# sourceMappingURL=index.js.map