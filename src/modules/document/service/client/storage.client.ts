// src/modules/document/service/client/storage.client.ts
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../../../shared/config/app.config';
import { logger } from '../../../../shared/utils/logger.util';
import { StorageProvider } from '../../domain/enum/document.enum';

export interface IStorageClient {
  save(buffer: Buffer, fileName: string): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
  getUrl(storagePath: string): Promise<string>;
}

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

    logger.debug('File saved to local storage', { storedName });
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
    return `${config.app.url}/api/${config.app.apiVersion}/documents/serve/${storedName}`;
  }
}

// Azure Blob Storage remains a stub until the Azure SDK adapter is needed.
export class AzureBlobStorageClient implements IStorageClient {
  async save(_buffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName);
    const blobName = `${uuidv4()}${ext}`;
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

export class AwsS3StorageClient implements IStorageClient {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor() {
    if (!config.storage.aws.bucket) {
      throw new Error('AWS_S3_BUCKET is required when STORAGE_PROVIDER=aws_s3');
    }

    this.bucket = config.storage.aws.bucket;
    this.keyPrefix = normalizePrefix(config.storage.aws.prefix);
    this.client = new S3Client({
      region: config.storage.aws.region,
      forcePathStyle: config.storage.aws.forcePathStyle,
    });
  }

  async save(buffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName);
    const now = new Date();
    const datePath = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      String(now.getUTCDate()).padStart(2, '0'),
    ].join('/');
    const objectKey = withPrefix(this.keyPrefix, `${datePath}/${uuidv4()}${ext}`);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
      }),
    );

    logger.debug('File saved to S3 storage', { objectKey, bucket: this.bucket });
    return objectKey;
  }

  async read(storagePath: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      }),
    );

    return streamToBuffer(response.Body);
  }

  async delete(storagePath: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      }),
    );
  }

  async getUrl(storagePath: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: config.storage.aws.signedUrlTtlSeconds,
    });
  }
}

type ByteArrayTransformer = {
  transformToByteArray: () => Promise<Uint8Array>;
};

const streamToBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) return Buffer.alloc(0);
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (hasByteArrayTransformer(body)) {
    return Buffer.from(await body.transformToByteArray());
  }
  if (!isAsyncIterable(body)) {
    throw new Error('Unsupported S3 response body type');
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const hasByteArrayTransformer = (body: unknown): body is ByteArrayTransformer =>
  typeof body === 'object' &&
  body !== null &&
  'transformToByteArray' in body &&
  typeof body.transformToByteArray === 'function';

const isAsyncIterable = (body: unknown): body is AsyncIterable<Uint8Array> =>
  typeof body === 'object' &&
  body !== null &&
  Symbol.asyncIterator in body;

const normalizePrefix = (prefix: string): string =>
  prefix.trim().replace(/^\/+|\/+$/g, '');

const withPrefix = (prefix: string, key: string): string =>
  prefix ? `${prefix}/${key}` : key;

export const createStorageClient = (
  provider: StorageProvider | string = config.storage.provider,
): IStorageClient => {
  switch (provider) {
    case StorageProvider.AZURE_BLOB:
      return new AzureBlobStorageClient();
    case StorageProvider.AWS_S3:
      return new AwsS3StorageClient();
    case StorageProvider.LOCAL:
    default:
      return new LocalStorageClient();
  }
};
