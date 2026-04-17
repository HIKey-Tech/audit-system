// src/modules/document/service/client/storage.client.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../../../shared/config/app.config';
import { logger } from '../../../../shared/utils/logger.util';

export interface IStorageClient {
  save(buffer: Buffer, fileName: string, mimeType: string): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
  getUrl(storagePath: string): Promise<string>;
}

// ──────────────────────────────────────────────
// Local Storage
// ──────────────────────────────────────────────
export class LocalStorageClient implements IStorageClient {
  private readonly basePath: string;

  constructor() {
    this.basePath = path.resolve(config.storage.localPath);
  }

  async save(buffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName);
    const storedName = `${uuidv4()}${ext}`;
    const filePath = path.join(this.basePath, storedName);

    await fs.mkdir(this.basePath, { recursive: true });
    await fs.writeFile(filePath, buffer);

    logger.debug({ storedName }, 'File saved to local storage');
    return storedName;
  }

  async read(storedName: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, storedName);
    return fs.readFile(filePath);
  }

  async delete(storedName: string): Promise<void> {
    const filePath = path.join(this.basePath, storedName);
    await fs.unlink(filePath).catch(() => {
      /* ignore if already deleted */
    });
  }

  async getUrl(storedName: string): Promise<string> {
    // Served by Express static or a dedicated endpoint
    return `${config.app.url}/api/${config.app.apiVersion}/documents/serve/${storedName}`;
  }
}

// ──────────────────────────────────────────────
// Azure Blob Storage (stub — implement as needed)
// ──────────────────────────────────────────────
export class AzureBlobStorageClient implements IStorageClient {
  async save(_buffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName);
    const blobName = `${uuidv4()}${ext}`;
    // TODO: implement @azure/storage-blob SDK
    logger.warn('AzureBlobStorageClient.save() not yet implemented');
    return blobName;
  }

  async read(_storagePath: string): Promise<Buffer> {
    throw new Error('AzureBlobStorageClient.read() not yet implemented');
  }

  async delete(_storagePath: string): Promise<void> {
    logger.warn('AzureBlobStorageClient.delete() not yet implemented');
  }

  async getUrl(storagePath: string): Promise<string> {
    return `https://${config.storage.azure.container}.blob.core.windows.net/${storagePath}`;
  }
}

// ──────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────
export const createStorageClient = (): IStorageClient => {
  switch (config.storage.provider) {
    case 'azure_blob':
      return new AzureBlobStorageClient();
    case 'local':
    default:
      return new LocalStorageClient();
  }
};
