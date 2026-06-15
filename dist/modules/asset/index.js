"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetService = exports.AssetService = exports.createAssetModule = void 0;
const express_1 = require("express");
const asset_controller_1 = require("./controller/asset.controller");
const asset_service_1 = require("./service/implementation/asset.service");
const createAssetModule = () => {
    const router = (0, express_1.Router)();
    const assetController = new asset_controller_1.AssetController(asset_service_1.assetService);
    router.use('/assets', assetController.router);
    router.use('/audit', assetController.auditRouter);
    return router;
};
exports.createAssetModule = createAssetModule;
var asset_service_2 = require("./service/implementation/asset.service");
Object.defineProperty(exports, "AssetService", { enumerable: true, get: function () { return asset_service_2.AssetService; } });
Object.defineProperty(exports, "assetService", { enumerable: true, get: function () { return asset_service_2.assetService; } });
//# sourceMappingURL=index.js.map