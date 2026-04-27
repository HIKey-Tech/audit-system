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
export declare const createStorageClient: () => IStorageClient;
//# sourceMappingURL=storage.client.d.ts.map