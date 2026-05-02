"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = exports.DashboardService = exports.createDashboardModule = void 0;
const express_1 = require("express");
const dashboard_controller_1 = require("./controller/dashboard.controller");
const dashboard_service_1 = require("./service/implementation/dashboard.service");
const createDashboardModule = () => {
    const router = (0, express_1.Router)();
    const dashboardController = new dashboard_controller_1.DashboardController(dashboard_service_1.dashboardService);
    router.use('/dashboard', dashboardController.router);
    return router;
};
exports.createDashboardModule = createDashboardModule;
var dashboard_service_2 = require("./service/implementation/dashboard.service");
Object.defineProperty(exports, "DashboardService", { enumerable: true, get: function () { return dashboard_service_2.DashboardService; } });
Object.defineProperty(exports, "dashboardService", { enumerable: true, get: function () { return dashboard_service_2.dashboardService; } });
//# sourceMappingURL=index.js.map