"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.UserService = exports.createUserModule = void 0;
// src/modules/user/index.ts
const express_1 = require("express");
const user_service_1 = require("./service/implementation/user.service");
const auth_service_1 = require("./service/implementation/auth.service");
const auth_controller_1 = require("./controller/auth.controller");
const user_controller_1 = require("./controller/user.controller");
// Side-effect imports — register OpenAPI paths with the shared registry.
require("./docs/auth.docs");
require("./docs/user.docs");
const createUserModule = () => {
    const router = (0, express_1.Router)();
    // Dependency wiring
    const userService = new user_service_1.UserService();
    const authService = new auth_service_1.AuthService(userService);
    // Controllers
    const authController = new auth_controller_1.AuthController(authService);
    const userController = new user_controller_1.UserController(userService);
    // Mount
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