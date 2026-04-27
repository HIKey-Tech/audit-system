"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStorageClient = exports.AzureBlobStorageClient = exports.LocalStorageClient = void 0;
// src/modules/document/service/client/storage.client.ts
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const app_config_1 = require("../../../../shared/config/app.config");
const logger_util_1 = require("../../../../shared/utils/logger.util");
// ──────────────────────────────────────────────
// Local Storage
// ──────────────────────────────────────────────
class LocalStorageClient {
    basePath;
    constructor() {
        this.basePath = path_1.default.resolve(app_config_1.config.storage.localPath);
    }
    async save(buffer, originalName) {
        const ext = path_1.default.extname(originalName);
        const storedName = `${(0, uuid_1.v4)()}${ext}`;
        const filePath = path_1.default.join(this.basePath, storedName);
        await promises_1.default.mkdir(this.basePath, { recursive: true });
        await promises_1.default.writeFile(filePath, buffer);
        logger_util_1.logger.debug('File saved to local storage', { storedName });
        return storedName;
    }
    async read(storedName) {
        const filePath = path_1.default.join(this.basePath, storedName);
        return promises_1.default.readFile(filePath);
    }
    async delete(storedName) {
        const filePath = path_1.default.join(this.basePath, storedName);
        await promises_1.default.unlink(filePath).catch(() => {
            /* ignore if already deleted */
        });
    }
    async getUrl(storedName) {
        // Served by Express static or a dedicated endpoint
        return `${app_config_1.config.app.url}/api/${app_config_1.config.app.apiVersion}/documents/serve/${storedName}`;
    }
}
exports.LocalStorageClient = LocalStorageClient;
// ──────────────────────────────────────────────
// Azure Blob Storage (stub — implement as needed)
// ──────────────────────────────────────────────
class AzureBlobStorageClient {
    async save(_buffer, originalName) {
        const ext = path_1.default.extname(originalName);
        const blobName = `${(0, uuid_1.v4)()}${ext}`;
        // TODO: implement @azure/storage-blob SDK
        logger_util_1.logger.warn('AzureBlobStorageClient.save() not yet implemented');
        return blobName;
    }
    async read(_storagePath) {
        throw new Error('AzureBlobStorageClient.read() not yet implemented');
    }
    async delete(_storagePath) {
        logger_util_1.logger.warn('AzureBlobStorageClient.delete() not yet implemented');
    }
    async getUrl(storagePath) {
        return `https://${app_config_1.config.storage.azure.container}.blob.core.windows.net/${storagePath}`;
    }
}
exports.AzureBlobStorageClient = AzureBlobStorageClient;
// ──────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────
const createStorageClient = () => {
    switch (app_config_1.config.storage.provider) {
        case 'azure_blob':
            return new AzureBlobStorageClient();
        case 'local':
        default:
            return new LocalStorageClient();
    }
};
exports.createStorageClient = createStorageClient;
//# sourceMappingURL=storage.client.js.map