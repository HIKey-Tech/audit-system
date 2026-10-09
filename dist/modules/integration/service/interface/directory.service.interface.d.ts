export interface DirectoryGroupMapping {
    id: string;
    adGroupId: string;
    adGroupName: string;
    roleId: string;
    roleName?: string;
    isActive: boolean;
    createdAt: Date;
}
export interface CreateMappingInput {
    adGroupId: string;
    adGroupName: string;
    roleId: string;
}
export interface UpdateMappingInput {
    adGroupName?: string;
    roleId?: string;
    isActive?: boolean;
}
/** A directory (Entra ID) account and its group memberships, for read-only access reviews. */
export interface DirectoryAccount {
    oid: string;
    email: string;
    displayName: string | null;
    accountEnabled: boolean;
    /** Group display names where a mapping names them; otherwise the group object id. */
    groups: string[];
}
export interface IDirectoryMappingService {
    createMapping(dto: CreateMappingInput, actorId: string): Promise<DirectoryGroupMapping>;
    updateMapping(id: string, dto: UpdateMappingInput, actorId: string): Promise<DirectoryGroupMapping>;
    deleteMapping(id: string, actorId: string): Promise<void>;
    listMappings(): Promise<DirectoryGroupMapping[]>;
    resolveRolesForGroups(groupIds: string[]): Promise<string[]>;
    applyAdRolesToUser(userId: string, groupIds: string[]): Promise<void>;
    runFullDirectorySync(): Promise<{
        usersProcessed: number;
        deactivated: number;
    }>;
    /** Read-only snapshot of every directory account and its groups. Requires directory sync to be enabled. */
    listDirectoryAccounts(): Promise<DirectoryAccount[]>;
}
//# sourceMappingURL=directory.service.interface.d.ts.map