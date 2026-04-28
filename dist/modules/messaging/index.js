"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = exports.createMessagingModule = void 0;
// src/modules/messaging/index.ts
const express_1 = require("express");
const notification_service_1 = require("./service/implementation/notification.service");
const notification_controller_1 = require("./controller/notification.controller");
const createMessagingModule = () => {
    const router = (0, express_1.Router)();
    // Controllers
    const notificationController = new notification_controller_1.NotificationController(notification_service_1.notificationService);
    // Mount
    router.use('/notifications', notificationController.router);
    return router;
};
exports.createMessagingModule = createMessagingModule;
// Re-export for use in other modules
var notification_service_2 = require("./service/implementation/notification.service");
Object.defineProperty(exports, "NotificationService", { enumerable: true, get: function () { return notification_service_2.NotificationService; } });
Object.defineProperty(exports, "notificationService", { enumerable: true, get: function () { return notification_service_2.notificationService; } });
//# sourceMappingURL=index.js.map