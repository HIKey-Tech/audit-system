import {
  ProjectPlusDocumentType,
  ProjectPlusEntityPage,
  ProjectPlusStatus,
} from '../../domain/entity/projectplus.entity';
import { ListProjectPlusEntitiesQuery } from '../../dto/request/projectplus.request.dto';

export interface IProjectPlusService {
  getStatus(): { enabled: boolean; configured: boolean };
  checkStatus(): Promise<ProjectPlusStatus>;
  listEntities(query: ListProjectPlusEntitiesQuery): Promise<ProjectPlusEntityPage>;
  getContractDocumentTypes(): Promise<ProjectPlusDocumentType[]>;
}
