"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateService = exports.TemplateService = exports.notificationQueueService = exports.NotificationQueueService = exports.notificationService = exports.NotificationService = exports.createMessagingModule = void 0;
// src/modules/messaging/index.ts
const express_1 = require("express");
const notification_service_1 = require("./service/implementation/notification.service");
const notification_queue_service_1 = require("./service/implementation/notification-queue.service");
const template_service_1 = require("./service/implementation/template.service");
const notification_controller_1 = require("./controller/notification.controller");
const template_controller_1 = require("./controller/template.controller");
const createMessagingModule = () => {
    const router = (0, express_1.Router)();
    // Controllers
    const notificationController = new notification_controller_1.NotificationController(notification_service_1.notificationService, notification_queue_service_1.notificationQueueService);
    const templateController = new template_controller_1.TemplateController(template_service_1.templateService);
    // Mount — order matters: more specific path first
    router.use('/notifications/templates', templateController.router);
    router.use('/notifications', notificationController.router);
    return router;
};
exports.createMessagingModule = createMessagingModule;
// Re-export for use in other modules
var notification_service_2 = require("./service/implementation/notification.service");
Object.defineProperty(exports, "NotificationService", { enumerable: true, get: function () { return notification_service_2.NotificationService; } });
Object.defineProperty(exports, "notificationService", { enumerable: true, get: function () { return notification_service_2.notificationService; } });
var notification_queue_service_2 = require("./service/implementation/notification-queue.service");
Object.defineProperty(exports, "NotificationQueueService", { enumerable: true, get: function () { return notification_queue_service_2.NotificationQueueService; } });
Object.defineProperty(exports, "notificationQueueService", { enumerable: true, get: function () { return notification_queue_service_2.notificationQueueService; } });
var template_service_2 = require("./service/implementation/template.service");
Object.defineProperty(exports, "TemplateService", { enumerable: true, get: function () { return template_service_2.TemplateService; } });
Object.defineProperty(exports, "templateService", { enumerable: true, get: function () { return template_service_2.templateService; } });
//# sourceMappingURL=index.js.map