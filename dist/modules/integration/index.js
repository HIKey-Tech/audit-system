"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.directoryMappingService = exports.DirectoryMappingService = exports.createIntegrationModule = void 0;
const express_1 = require("express");
const directory_mapping_controller_1 = require("./controller/directory-mapping.controller");
const directory_mapping_service_1 = require("./service/implementation/directory-mapping.service");
const createIntegrationModule = () => {
    const router = (0, express_1.Router)();
    const controller = new directory_mapping_controller_1.DirectoryMappingController(directory_mapping_service_1.directoryMappingService);
    router.use('/integration/directory', controller.router);
    return router;
};
exports.createIntegrationModule = createIntegrationModule;
var directory_mapping_service_2 = require("./service/implementation/directory-mapping.service");
Object.defineProperty(exports, "DirectoryMappingService", { enumerable: true, get: function () { return directory_mapping_service_2.DirectoryMappingService; } });
Object.defineProperty(exports, "directoryMappingService", { enumerable: true, get: function () { return directory_mapping_service_2.directoryMappingService; } });
//# sourceMappingURL=index.js.map