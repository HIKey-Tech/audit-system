import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EngagementStatus } from '../../../domain/enum/audit.enum';
import { IChecklistService } from '../../../checklists/service/interface/checklist.service.interface';
import { CreateAdhocEngagementRequestDto, CreateEngagementFromPlanRequestDto, EngagementQueryDto, UpdateEngagementRequestDto } from '../../dto/request/engagement.request.dto';
import { EngagementResponseDto } from '../../dto/response/engagement.response.dto';
import { IEngagementService } from '../interface/engagement.service.interface';
export declare class EngagementService implements IEngagementService {
    private readonly checklistService;
    constructor(checklistService: IChecklistService);
    createFromPlanItem(planItemId: string, dto: CreateEngagementFromPlanRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    createAdhoc(dto: CreateAdhocEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    updateEngagement(id: string, dto: UpdateEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    updateStatus(id: string, newStatus: EngagementStatus, actor: ActorContext): Promise<EngagementResponseDto>;
    getEngagementById(id: string, actor: ActorContext): Promise<EngagementResponseDto>;
    listEngagements(query: EngagementQueryDto, actor: ActorContext): Promise<{
        engagements: EngagementResponseDto[];
        meta: PaginationMeta;
    }>;
    private _nextReferenceNumber;
    private _assertEngagementExists;
    private _withMetrics;
}
//# sourceMappingURL=engagement.service.d.ts.map