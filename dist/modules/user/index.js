"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.UserService = exports.createUserModule = void 0;
// src/modules/user/index.ts
const express_1 = require("express");
const user_service_1 = require("./service/implementation/user.service");
const auth_service_1 = require("./service/implementation/auth.service");
const password_reset_service_1 = require("./service/implementation/password-reset.service");
const mfa_service_1 = require("./service/implementation/mfa.service");
const auth_controller_1 = require("./controller/auth.controller");
const mfa_controller_1 = require("./controller/mfa.controller");
const user_controller_1 = require("./controller/user.controller");
const notification_queue_service_1 = require("../messaging/service/implementation/notification-queue.service");
// Side-effect imports — register OpenAPI paths with the shared registry.
require("./docs/auth.docs");
require("./docs/user.docs");
const createUserModule = () => {
    const router = (0, express_1.Router)();
    // Dependency wiring
    const userService = new user_service_1.UserService();
    const mfaService = new mfa_service_1.MfaService(notification_queue_service_1.notificationQueueService);
    const authService = new auth_service_1.AuthService(userService, mfaService);
    const passwordResetService = new password_reset_service_1.PasswordResetService(notification_queue_service_1.notificationQueueService);
    // Controllers
    const authController = new auth_controller_1.AuthController(authService, passwordResetService);
    const mfaController = new mfa_controller_1.MfaController(mfaService, authService);
    const userController = new user_controller_1.UserController(userService);
    // Mount — /auth/2fa must precede /auth so its routes resolve first.
    router.use('/auth/2fa', mfaController.router);
    router.use('/auth', authController.router);
    router.use('/users', userController.router);
    return router;
};
exports.createUserModule = createUserModule;
// Re-export for use in other modules
var user_service_2 = require("./service/implementation/user.service");
Object.defineProperty(exports, "UserService", { enumerable: true, get: function () { return user_service_2.UserService; } });
var auth_service_2 = require("./service/implementation/auth.service");
Object.defineProperty(exports, "AuthService", { enumerable: true, get: function () { return auth_service_2.AuthService; } });
//# sourceMappingURL=index.js.map