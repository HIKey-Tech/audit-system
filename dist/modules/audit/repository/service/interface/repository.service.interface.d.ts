import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ServedFileDto } from '../../../../document/dto/response/document.response.dto';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { RepositoryQueryDto } from '../../dto/request/repository.request.dto';
import { RepositoryItemResponseDto } from '../../dto/response/repository.response.dto';
export interface IRepositoryService {
    /**
     * Centralized audit repository — every audit record, supporting document and
     * piece of evidence in one paginated, category-filterable list.
     */
    list(query: RepositoryQueryDto, actor: ActorContext): Promise<{
        items: RepositoryItemResponseDto[];
        meta: PaginationMeta;
    }>;
    /**
     * Stream a single repository item's bytes. Provider-agnostic (local or S3)
     * and gated by the same `engagement:read` permission as the list, so there
     * is no second-permission seam on download.
     */
    getFile(documentId: string, actor: ActorContext): Promise<ServedFileDto>;
}
//# sourceMappingURL=repository.service.interface.d.ts.map