"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECURITY_LOG_MODULE = exports.SecurityEvent = exports.logSecurityEvent = exports.SystemLogTransport = exports.systemLogService = exports.SystemLogService = exports.auditLogService = exports.AuditLogService = exports.createLoggingModule = void 0;
// src/modules/logging/index.ts
const express_1 = require("express");
const logging_controller_1 = require("./controller/logging.controller");
const audit_log_service_1 = require("./service/implementation/audit-log.service");
const system_log_service_1 = require("./service/implementation/system-log.service");
const createLoggingModule = () => {
    const router = (0, express_1.Router)();
    // Controllers
    const loggingController = new logging_controller_1.LoggingController(audit_log_service_1.auditLogService, system_log_service_1.systemLogService);
    // Mount
    router.use('/logs', loggingController.router);
    return router;
};
exports.createLoggingModule = createLoggingModule;
// Re-export for use in other modules
var audit_log_service_2 = require("./service/implementation/audit-log.service");
Object.defineProperty(exports, "AuditLogService", { enumerable: true, get: function () { return audit_log_service_2.AuditLogService; } });
Object.defineProperty(exports, "auditLogService", { enumerable: true, get: function () { return audit_log_service_2.auditLogService; } });
var system_log_service_2 = require("./service/implementation/system-log.service");
Object.defineProperty(exports, "SystemLogService", { enumerable: true, get: function () { return system_log_service_2.SystemLogService; } });
Object.defineProperty(exports, "systemLogService", { enumerable: true, get: function () { return system_log_service_2.systemLogService; } });
var system_log_transport_1 = require("./utility/system-log.transport");
Object.defineProperty(exports, "SystemLogTransport", { enumerable: true, get: function () { return system_log_transport_1.SystemLogTransport; } });
var security_event_utility_1 = require("./utility/security-event.utility");
Object.defineProperty(exports, "logSecurityEvent", { enumerable: true, get: function () { return security_event_utility_1.logSecurityEvent; } });
var logging_enum_1 = require("./domain/enum/logging.enum");
Object.defineProperty(exports, "SecurityEvent", { enumerable: true, get: function () { return logging_enum_1.SecurityEvent; } });
Object.defineProperty(exports, "SECURITY_LOG_MODULE", { enumerable: true, get: function () { return logging_enum_1.SECURITY_LOG_MODULE; } });
//# sourceMappingURL=index.js.map