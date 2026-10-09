import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ExportFormat, TabularExportFile } from '../../../../../shared/utils/tabular-export.util';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { AccessItemListQueryDto, DecideAccessItemsDto } from '../../dto/request/access-review.request.dto';
import { AccessReviewItemResponseDto } from '../../dto/response/access-review.response.dto';
/**
 * The per-account worklist of a user access review (an access_listing run).
 * Reviewers record whether each account's access is appropriate; decisions are
 * recommendations held in IAMS — the reviewed system is never modified.
 */
export interface IAccessReviewService {
    listItems(runId: string, query: AccessItemListQueryDto, actor: SystemAuditActor): Promise<{
        items: AccessReviewItemResponseDto[];
        meta: PaginationMeta;
    }>;
    decideItems(runId: string, dto: DecideAccessItemsDto, actor: SystemAuditActor): Promise<{
        updated: number;
    }>;
    exportItems(runId: string, format: ExportFormat, actor: SystemAuditActor): Promise<TabularExportFile>;
}
//# sourceMappingURL=access-review.service.interface.d.ts.map