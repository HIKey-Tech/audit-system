"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyStorageReady = exports.createStorageClient = exports.AwsS3StorageClient = exports.AzureBlobStorageClient = exports.LocalStorageClient = void 0;
// src/modules/document/service/client/storage.client.ts
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const app_config_1 = require("../../../../shared/config/app.config");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const document_enum_1 = require("../../domain/enum/document.enum");
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
        return `${app_config_1.config.app.url}/api/${app_config_1.config.app.apiVersion}/documents/serve/${storedName}`;
    }
}
exports.LocalStorageClient = LocalStorageClient;
// Azure Blob Storage remains a stub until the Azure SDK adapter is needed.
class AzureBlobStorageClient {
    async save(_buffer, originalName) {
        const ext = path_1.default.extname(originalName);
        const blobName = `${(0, uuid_1.v4)()}${ext}`;
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
class AwsS3StorageClient {
    client;
    bucket;
    keyPrefix;
    constructor() {
        if (!app_config_1.config.storage.aws.bucket) {
            throw new Error('AWS_S3_BUCKET is required when STORAGE_PROVIDER=aws_s3');
        }
        this.bucket = app_config_1.config.storage.aws.bucket;
        this.keyPrefix = normalizePrefix(app_config_1.config.storage.aws.prefix);
        this.client = new client_s3_1.S3Client({
            region: app_config_1.config.storage.aws.region,
            forcePathStyle: app_config_1.config.storage.aws.forcePathStyle,
        });
    }
    async save(buffer, originalName) {
        const ext = path_1.default.extname(originalName);
        const now = new Date();
        const datePath = [
            now.getUTCFullYear(),
            String(now.getUTCMonth() + 1).padStart(2, '0'),
            String(now.getUTCDate()).padStart(2, '0'),
        ].join('/');
        const objectKey = withPrefix(this.keyPrefix, `${datePath}/${(0, uuid_1.v4)()}${ext}`);
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: objectKey,
            Body: buffer,
        }));
        logger_util_1.logger.debug('File saved to S3 storage', { objectKey, bucket: this.bucket });
        return objectKey;
    }
    async read(storagePath) {
        const response = await this.client.send(new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: storagePath,
        }));
        return streamToBuffer(response.Body);
    }
    async delete(storagePath) {
        await this.client.send(new client_s3_1.DeleteObjectCommand({
            Bucket: this.bucket,
            Key: storagePath,
        }));
    }
    async getUrl(storagePath) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: storagePath,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.client, command, {
            expiresIn: app_config_1.config.storage.aws.signedUrlTtlSeconds,
        });
    }
}
exports.AwsS3StorageClient = AwsS3StorageClient;
const streamToBuffer = async (body) => {
    if (!body)
        return Buffer.alloc(0);
    if (body instanceof Uint8Array)
        return Buffer.from(body);
    if (hasByteArrayTransformer(body)) {
        return Buffer.from(await body.transformToByteArray());
    }
    if (!isAsyncIterable(body)) {
        throw new Error('Unsupported S3 response body type');
    }
    const chunks = [];
    for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};
const hasByteArrayTransformer = (body) => typeof body === 'object' &&
    body !== null &&
    'transformToByteArray' in body &&
    typeof body.transformToByteArray === 'function';
const isAsyncIterable = (body) => typeof body === 'object' &&
    body !== null &&
    Symbol.asyncIterator in body;
const normalizePrefix = (prefix) => prefix.trim().replace(/^\/+|\/+$/g, '');
const withPrefix = (prefix, key) => prefix ? `${prefix}/${key}` : key;
const createStorageClient = (provider = app_config_1.config.storage.provider) => {
    switch (provider) {
        case document_enum_1.StorageProvider.AZURE_BLOB:
            return new AzureBlobStorageClient();
        case document_enum_1.StorageProvider.AWS_S3:
            return new AwsS3StorageClient();
        case document_enum_1.StorageProvider.LOCAL:
        default:
            return new LocalStorageClient();
    }
};
exports.createStorageClient = createStorageClient;
/**
 * Boot-time check that the configured storage backend is usable, so a
 * misconfigured deployment fails fast instead of on the first upload.
 *
 * For the local provider this creates the upload directory if missing and
 * confirms the process can write to it (the common VPS failure mode: wrong
 * STORAGE_LOCAL_PATH or directory not owned by the Node user). Remote
 * providers are left to surface auth/permission errors on first request.
 */
const verifyStorageReady = async (provider = app_config_1.config.storage.provider) => {
    if (provider !== document_enum_1.StorageProvider.LOCAL)
        return;
    const basePath = path_1.default.resolve(app_config_1.config.storage.localPath);
    const probe = path_1.default.join(basePath, `.write-test-${(0, uuid_1.v4)()}`);
    try {
        await promises_1.default.mkdir(basePath, { recursive: true });
        await promises_1.default.writeFile(probe, 'ok');
        await promises_1.default.unlink(probe);
        logger_util_1.logger.info('Local document storage verified writable', { basePath });
    }
    catch (err) {
        throw new Error(`Local document storage is not writable at "${basePath}" — set STORAGE_LOCAL_PATH ` +
            `to a directory the application user can write to. Cause: ${String(err)}`);
    }
};
exports.verifyStorageReady = verifyStorageReady;
//# sourceMappingURL=storage.client.js.map