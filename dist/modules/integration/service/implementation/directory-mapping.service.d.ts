import { IGraphDirectoryClient } from '../client/graph.client';
import { IDirectoryMappingService, DirectoryGroupMapping, CreateMappingInput, UpdateMappingInput } from '../interface/directory.service.interface';
export declare class DirectoryMappingService implements IDirectoryMappingService {
    private readonly graph;
    constructor(graph?: IGraphDirectoryClient);
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
    private _assertExists;
}
export declare const directoryMappingService: DirectoryMappingService;
//# sourceMappingURL=directory-mapping.service.d.ts.map