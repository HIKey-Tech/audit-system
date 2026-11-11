import { ProjectPlusDocumentType, ProjectPlusEntityPage, ProjectPlusStatus } from '../../domain/entity/projectplus.entity';
import { ListProjectPlusEntitiesQuery } from '../../dto/request/projectplus.request.dto';
import { IProjectPlusClient } from '../client/projectplus.client';
import { IProjectPlusService } from '../interface/projectplus.service.interface';
/**
 * Read-only passthrough. The gateway returns the whole customer list for a type,
 * so search/status filtering and pagination are applied here. Nothing is stored.
 */
export declare class ProjectPlusService implements IProjectPlusService {
    private readonly client;
    constructor(client: IProjectPlusClient);
    getStatus(): {
        enabled: boolean;
        configured: boolean;
    };
    checkStatus(): Promise<ProjectPlusStatus>;
    listEntities(query: ListProjectPlusEntitiesQuery): Promise<ProjectPlusEntityPage>;
    getContractDocumentTypes(): Promise<ProjectPlusDocumentType[]>;
}
//# sourceMappingURL=projectplus.service.d.ts.map