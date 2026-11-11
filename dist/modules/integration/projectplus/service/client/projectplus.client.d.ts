import { ProjectPlusDocumentType, ProjectPlusEntity, ProjectPlusStatus } from '../../domain/entity/projectplus.entity';
/**
 * Read-only contract with Project Plus (via the Hub360 gateway). Only GET
 * operations exist on this interface — the gateway's create/update/approve
 * endpoints are intentionally not representable, so IAMS cannot write to it.
 */
export interface IProjectPlusClient {
    readonly enabled: boolean;
    readonly configured: boolean;
    listEntities(customerType: string): Promise<ProjectPlusEntity[]>;
    getContractDocumentTypes(): Promise<ProjectPlusDocumentType[]>;
    checkStatus(): Promise<ProjectPlusStatus>;
}
export type ProjectPlusFetch = (input: string, init: RequestInit) => Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
}>;
export declare class HttpProjectPlusClient implements IProjectPlusClient {
    private readonly fetchImpl;
    private readonly settings;
    readonly enabled = true;
    readonly configured: boolean;
    constructor(fetchImpl?: ProjectPlusFetch, settings?: {
        readonly enabled: boolean;
        readonly baseUrl: string;
        readonly authMode: string;
        readonly authHeader: string;
        readonly authSecret: string;
        readonly timeoutMs: number;
        readonly caCertPath: string;
    });
    listEntities(customerType: string): Promise<ProjectPlusEntity[]>;
    getContractDocumentTypes(): Promise<ProjectPlusDocumentType[]>;
    checkStatus(): Promise<ProjectPlusStatus>;
    private _headers;
    /** The only transport method — GET only, by construction. */
    private _get;
}
export declare const createProjectPlusClient: () => IProjectPlusClient;
//# sourceMappingURL=projectplus.client.d.ts.map