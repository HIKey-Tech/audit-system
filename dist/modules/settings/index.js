"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemConfigService = exports.SystemConfigService = exports.reportTemplateService = exports.ReportTemplateService = exports.workingPaperTemplateService = exports.WorkingPaperTemplateService = exports.createSettingsModule = void 0;
const express_1 = require("express");
const user_service_1 = require("../user/service/implementation/user.service");
const settings_controller_1 = require("../user/controller/settings.controller");
const working_paper_template_controller_1 = require("./controller/working-paper-template.controller");
const report_template_controller_1 = require("./controller/report-template.controller");
const system_config_controller_1 = require("./controller/system-config.controller");
const working_paper_template_service_1 = require("./service/implementation/working-paper-template.service");
const report_template_service_1 = require("./service/implementation/report-template.service");
const system_config_service_1 = require("./service/implementation/system-config.service");
const createSettingsModule = () => {
    const router = (0, express_1.Router)();
    // Dependency wiring
    const userService = new user_service_1.UserService();
    // Controllers
    const roleSettingsController = new settings_controller_1.SettingsController(userService);
    const workingPaperTemplateController = new working_paper_template_controller_1.WorkingPaperTemplateController(working_paper_template_service_1.workingPaperTemplateService);
    const reportTemplateController = new report_template_controller_1.ReportTemplateController(report_template_service_1.reportTemplateService);
    const systemConfigController = new system_config_controller_1.SystemConfigController(system_config_service_1.systemConfigService);
    // Mount
    router.use('/settings/working-paper-templates', workingPaperTemplateController.router);
    router.use('/settings/report-templates', reportTemplateController.router);
    router.use('/settings/config', systemConfigController.router);
    router.use('/settings', roleSettingsController.router);
    return router;
};
exports.createSettingsModule = createSettingsModule;
var working_paper_template_service_2 = require("./service/implementation/working-paper-template.service");
Object.defineProperty(exports, "WorkingPaperTemplateService", { enumerable: true, get: function () { return working_paper_template_service_2.WorkingPaperTemplateService; } });
Object.defineProperty(exports, "workingPaperTemplateService", { enumerable: true, get: function () { return working_paper_template_service_2.workingPaperTemplateService; } });
var report_template_service_2 = require("./service/implementation/report-template.service");
Object.defineProperty(exports, "ReportTemplateService", { enumerable: true, get: function () { return report_template_service_2.ReportTemplateService; } });
Object.defineProperty(exports, "reportTemplateService", { enumerable: true, get: function () { return report_template_service_2.reportTemplateService; } });
var system_config_service_2 = require("./service/implementation/system-config.service");
Object.defineProperty(exports, "SystemConfigService", { enumerable: true, get: function () { return system_config_service_2.SystemConfigService; } });
Object.defineProperty(exports, "systemConfigService", { enumerable: true, get: function () { return system_config_service_2.systemConfigService; } });
//# sourceMappingURL=index.js.map