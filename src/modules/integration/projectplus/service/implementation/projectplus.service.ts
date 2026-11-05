import { config } from '../../../../../shared/config/app.config';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  ProjectPlusDocumentType,
  ProjectPlusEntityPage,
  ProjectPlusStatus,
} from '../../domain/entity/projectplus.entity';
import { ListProjectPlusEntitiesQuery } from '../../dto/request/projectplus.request.dto';
import { matchesProjectPlusSearch } from '../../utility/projectplus.utility';
import { IProjectPlusClient } from '../client/projectplus.client';
import { IProjectPlusService } from '../interface/projectplus.service.interface';

/**
 * Read-only passthrough. The gateway returns the whole customer list for a type,
 * so search/status filtering and pagination are applied here. Nothing is stored.
 */
export class ProjectPlusService implements IProjectPlusService {
  constructor(private readonly client: IProjectPlusClient) {}

  getStatus(): { enabled: boolean; configured: boolean } {
    return { enabled: this.client.enabled, configured: this.client.configured };
  }

  checkStatus(): Promise<ProjectPlusStatus> {
    return this.client.checkStatus();
  }

  async listEntities(query: ListProjectPlusEntitiesQuery): Promise<ProjectPlusEntityPage> {
    const all = await this.client.listEntities(query.customerType);
    const status = query.status?.toLowerCase();
    const filtered = all.filter(
      (e) =>
        (!status || e.status?.toLowerCase() === status) &&
        (!query.search || matchesProjectPlusSearch(e, query.search)),
    );
    const start = (query.page - 1) * query.pageSize;
    logger.info('Project Plus entities listed', {
      customerType: query.customerType,
      fetched: all.length,
      matched: filtered.length,
    });
    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  getContractDocumentTypes(): Promise<ProjectPlusDocumentType[]> {
    return this.client.getContractDocumentTypes();
  }
}
