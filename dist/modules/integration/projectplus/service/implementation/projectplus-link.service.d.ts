import { ActorContext } from '../../../../audit/domain/entity/audit.entity';
import { LinkProjectPlusEntityDto } from '../../dto/request/projectplus.request.dto';
import { ProjectPlusEntityLinkResponseDto } from '../../dto/response/projectplus.response.dto';
import { IProjectPlusClient } from '../client/projectplus.client';
import { IProjectPlusLinkService } from '../interface/projectplus-link.service.interface';
/**
 * Optional engagement ↔ Project Plus entity association. Writes only to IAMS's
 * own table; Project Plus itself is only ever read.
 */
export declare class ProjectPlusLinkService implements IProjectPlusLinkService {
    private readonly client;
    constructor(client: IProjectPlusClient);
    listLinks(engagementId: string, actor: ActorContext): Promise<ProjectPlusEntityLinkResponseDto[]>;
    getLink(id: string): Promise<ProjectPlusEntityLinkResponseDto>;
    linkEntity(engagementId: string, dto: LinkProjectPlusEntityDto, actor: ActorContext): Promise<ProjectPlusEntityLinkResponseDto>;
    unlinkEntity(id: string, actor: ActorContext): Promise<void>;
    private _getActive;
}
//# sourceMappingURL=projectplus-link.service.d.ts.map