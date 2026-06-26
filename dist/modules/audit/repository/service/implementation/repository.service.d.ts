import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ServedFileDto } from '../../../../document/dto/response/document.response.dto';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { RepositoryQueryDto } from '../../dto/request/repository.request.dto';
import { RepositoryItemResponseDto } from '../../dto/response/repository.response.dto';
import { IRepositoryService } from '../interface/repository.service.interface';
export declare class RepositoryService implements IRepositoryService {
    private readonly documentService;
    constructor(documentService: IDocumentService);
    list(query: RepositoryQueryDto, actor: ActorContext): Promise<{
        items: RepositoryItemResponseDto[];
        meta: PaginationMeta;
    }>;
    getFile(documentId: string, actor: ActorContext): Promise<ServedFileDto>;
    /**
     * The set of engagement ids whose documents the actor may see, or `null` for
     * unrestricted (oversight / `engagement:read_all`) access. An empty set means
     * the actor is party to no engagements.
     */
    private _visibleEngagementIds;
    /**
     * Build the document-level OR filter that restricts results to the given
     * engagements. Documents reference engagements either directly (evidence and
     * working-paper-source store the engagement id) or via a child entity
     * (reports, snapshots, follow-up evidence), so we resolve those child ids
     * first. Mirrors the forward mapping in {@link _resolveEngagements}.
     */
    private _engagementScopedDocFilter;
    /**
     * Resolve the owning engagement for a page of documents. Evidence and
     * working-paper-source docs store the engagement id directly; reports,
     * snapshots and follow-up evidence store a child entity id that we batch
     * back to its engagement. Bounded by page size — a handful of indexed
     * lookups, never N+1.
     */
    private _resolveEngagements;
}
//# sourceMappingURL=repository.service.d.ts.map