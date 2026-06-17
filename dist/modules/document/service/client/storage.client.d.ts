import { StorageProvider } from '../../domain/enum/document.enum';
export interface IStorageClient {
    save(buffer: Buffer, fileName: string): Promise<string>;
    read(storagePath: string): Promise<Buffer>;
    delete(storagePath: string): Promise<void>;
    getUrl(storagePath: string): Promise<string>;
}
export declare class LocalStorageClient implements IStorageClient {
    private readonly basePath;
    constructor();
    save(buffer: Buffer, originalName: string): Promise<string>;
    read(storedName: string): Promise<Buffer>;
    delete(storedName: string): Promise<void>;
    getUrl(storedName: string): Promise<string>;
}
export declare class AzureBlobStorageClient implements IStorageClient {
    save(_buffer: Buffer, originalName: string): Promise<string>;
    read(_storagePath: string): Promise<Buffer>;
    delete(_storagePath: string): Promise<void>;
    getUrl(storagePath: string): Promise<string>;
}
export declare class AwsS3StorageClient implements IStorageClient {
    private readonly client;
    private readonly bucket;
    private readonly keyPrefix;
    constructor();
    save(buffer: Buffer, originalName: string): Promise<string>;
    read(storagePath: string): Promise<Buffer>;
    delete(storagePath: string): Promise<void>;
    getUrl(storagePath: string): Promise<string>;
}
export declare const createStorageClient: (provider?: StorageProvider | string) => IStorageClient;
/**
 * Boot-time check that the configured storage backend is usable, so a
 * misconfigured deployment fails fast instead of on the first upload.
 *
 * For the local provider this creates the upload directory if missing and
 * confirms the process can write to it (the common VPS failure mode: wrong
 * STORAGE_LOCAL_PATH or directory not owned by the Node user). Remote
 * providers are left to surface auth/permission errors on first request.
 */
export declare const verifyStorageReady: (provider?: StorageProvider | string) => Promise<void>;
//# sourceMappingURL=storage.client.d.ts.map