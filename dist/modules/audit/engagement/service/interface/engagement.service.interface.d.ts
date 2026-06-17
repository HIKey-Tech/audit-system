import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EngagementStatus } from '../../../domain/enum/audit.enum';
import { CreateAdhocEngagementRequestDto, CreateEngagementFromPlanRequestDto, EligibleUsersQueryDto, EngagementQueryDto, UpdateEngagementRequestDto } from '../../dto/request/engagement.request.dto';
import { EligibleUserDto, EngagementResponseDto } from '../../dto/response/engagement.response.dto';
export interface IEngagementService {
    createFromPlanItem(planItemId: string, dto: CreateEngagementFromPlanRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    createAdhoc(dto: CreateAdhocEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    updateEngagement(id: string, dto: UpdateEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    updateStatus(id: string, newStatus: EngagementStatus, actor: ActorContext): Promise<EngagementResponseDto>;
    getEngagementById(id: string, actor: ActorContext): Promise<EngagementResponseDto>;
    listEngagements(query: EngagementQueryDto, actor: ActorContext): Promise<{
        engagements: EngagementResponseDto[];
        meta: PaginationMeta;
    }>;
    getEligibleUsers(query: EligibleUsersQueryDto): Promise<EligibleUserDto[]>;
}
//# sourceMappingURL=engagement.service.interface.d.ts.map