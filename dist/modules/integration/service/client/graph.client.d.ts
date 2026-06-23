export interface DirectoryUser {
    oid: string;
    email: string;
    displayName?: string;
    accountEnabled: boolean;
    groupIds: string[];
}
export interface IGraphDirectoryClient {
    /** Overage fallback: fetch a single user's security-group ids. */
    getUserGroupIds(oid: string): Promise<string[]>;
    /** Nightly sync: all users with their group memberships + enabled flag. */
    listUsersWithGroups(): Promise<DirectoryUser[]>;
}
export declare const createGraphDirectoryClient: () => IGraphDirectoryClient;
//# sourceMappingURL=graph.client.d.ts.map