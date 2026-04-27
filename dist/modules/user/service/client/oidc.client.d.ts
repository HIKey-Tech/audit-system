import { AzureAdProfile } from '../interface/user.service.interface';
export interface OidcAuthResult {
    profile: AzureAdProfile;
    idToken: string;
    accessToken?: string;
}
export interface IOidcClient {
    getAuthorizationUrl(state?: string): Promise<{
        url: string;
        state: string;
    }>;
    handleCallback(code: string, state: string): Promise<OidcAuthResult>;
}
export declare class AzureAdOidcClient implements IOidcClient {
    private readonly msalClient;
    private readonly cryptoProvider;
    constructor();
    getAuthorizationUrl(state?: string): Promise<{
        url: string;
        state: string;
    }>;
    handleCallback(code: string, state: string): Promise<OidcAuthResult>;
}
export declare class GenericOidcClient implements IOidcClient {
    private clientPromise;
    private getClient;
    getAuthorizationUrl(state?: string): Promise<{
        url: string;
        state: string;
    }>;
    handleCallback(code: string, state: string): Promise<OidcAuthResult>;
}
export declare const createOidcClient: () => IOidcClient;
//# sourceMappingURL=oidc.client.d.ts.map