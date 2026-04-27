"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = exports.createDocumentModule = void 0;
// src/modules/document/index.ts
const express_1 = require("express");
const document_service_1 = require("./service/implementation/document.service");
const document_controller_1 = require("./controller/document.controller");
// Side-effect imports — register OpenAPI paths with the shared registry.
require("./docs/document.docs");
const createDocumentModule = () => {
    const router = (0, express_1.Router)();
    // Dependency wiring
    const documentService = new document_service_1.DocumentService();
    // Controllers
    const documentController = new document_controller_1.DocumentController(documentService);
    // Mount
    router.use('/documents', documentController.router);
    return router;
};
exports.createDocumentModule = createDocumentModule;
// Re-export for use in other modules
var document_service_2 = require("./service/implementation/document.service");
Object.defineProperty(exports, "DocumentService", { enumerable: true, get: function () { return document_service_2.DocumentService; } });
//# sourceMappingURL=index.js.map