"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogService = exports.AuditLogService = exports.createLoggingModule = void 0;
// src/modules/logging/index.ts
const express_1 = require("express");
const logging_controller_1 = require("./controller/logging.controller");
const audit_log_service_1 = require("./service/implementation/audit-log.service");
const createLoggingModule = () => {
    const router = (0, express_1.Router)();
    // Controllers
    const loggingController = new logging_controller_1.LoggingController(audit_log_service_1.auditLogService);
    // Mount
    router.use('/logs', loggingController.router);
    return router;
};
exports.createLoggingModule = createLoggingModule;
// Re-export for use in other modules
var audit_log_service_2 = require("./service/implementation/audit-log.service");
Object.defineProperty(exports, "AuditLogService", { enumerable: true, get: function () { return audit_log_service_2.AuditLogService; } });
Object.defineProperty(exports, "auditLogService", { enumerable: true, get: function () { return audit_log_service_2.auditLogService; } });
//# sourceMappingURL=index.js.map