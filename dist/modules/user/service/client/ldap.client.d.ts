import { LdapUserProfile } from '../interface/user.service.interface';
export interface LdapAuthResult {
    success: boolean;
    reason?: 'invalid_credentials' | 'user_not_found' | 'account_disabled' | 'account_locked' | 'connection_failed';
    message?: string;
    profile?: LdapUserProfile;
}
export interface ILdapClient {
    authenticate(usernameOrEmail: string, password: string): Promise<LdapAuthResult>;
    searchUser(usernameOrEmail: string): Promise<LdapUserProfile | null>;
    listUsers(): Promise<LdapUserProfile[]>;
    testConnection(): Promise<{
        success: boolean;
        message: string;
        details?: Record<string, unknown>;
    }>;
}
/**
 * Real LDAP client for on-premises Windows Server Active Directory Domain Services.
 */
export declare class LdapClient implements ILdapClient {
    private _createClient;
    testConnection(): Promise<{
        success: boolean;
        message: string;
        details?: Record<string, unknown>;
    }>;
    searchUser(usernameOrEmail: string): Promise<LdapUserProfile | null>;
    authenticate(usernameOrEmail: string, password: string): Promise<LdapAuthResult>;
    listUsers(): Promise<LdapUserProfile[]>;
    private _mapEntryToProfile;
}
/**
 * Stub LDAP client for test or disabled environments.
 */
export declare class StubLdapClient implements ILdapClient {
    authenticate(): Promise<LdapAuthResult>;
    searchUser(): Promise<LdapUserProfile | null>;
    listUsers(): Promise<LdapUserProfile[]>;
    testConnection(): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare const createLdapClient: () => ILdapClient;
export declare const ldapClient: ILdapClient;
//# sourceMappingURL=ldap.client.d.ts.map