import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ExportFormat, TabularExportFile } from '../../../../../shared/utils/tabular-export.util';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { ISystemAuditAnalyticsService } from '../../../analytics/service/interface/analytics.service.interface';
import { AccessItemListQueryDto, DecideAccessItemsDto } from '../../dto/request/access-review.request.dto';
import { AccessReviewItemResponseDto } from '../../dto/response/access-review.response.dto';
import { IAccessReviewService } from '../interface/access-review.service.interface';
export declare class AccessReviewService implements IAccessReviewService {
    private readonly analyticsService;
    constructor(analyticsService: ISystemAuditAnalyticsService);
    listItems(runId: string, query: AccessItemListQueryDto, actor: SystemAuditActor): Promise<{
        items: AccessReviewItemResponseDto[];
        meta: PaginationMeta;
    }>;
    decideItems(runId: string, dto: DecideAccessItemsDto, actor: SystemAuditActor): Promise<{
        updated: number;
    }>;
    exportItems(runId: string, format: ExportFormat, actor: SystemAuditActor): Promise<TabularExportFile>;
    private _assertAccessReview;
}
//# sourceMappingURL=access-review.service.d.ts.map