import { ActorContext } from '../../../../audit/domain/entity/audit.entity';
import { LinkProjectPlusEntityDto } from '../../dto/request/projectplus.request.dto';
import { ProjectPlusEntityLinkResponseDto } from '../../dto/response/projectplus.response.dto';

export interface IProjectPlusLinkService {
  listLinks(engagementId: string, actor: ActorContext): Promise<ProjectPlusEntityLinkResponseDto[]>;
  getLink(id: string): Promise<ProjectPlusEntityLinkResponseDto>;
  linkEntity(engagementId: string, dto: LinkProjectPlusEntityDto, actor: ActorContext): Promise<ProjectPlusEntityLinkResponseDto>;
  unlinkEntity(id: string, actor: ActorContext): Promise<void>;
}
