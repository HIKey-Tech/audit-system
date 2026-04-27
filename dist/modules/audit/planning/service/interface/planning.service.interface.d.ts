import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { AddPlanItemRequestDto, CreatePlanRequestDto, PlanQueryDto } from '../../dto/request/planning.request.dto';
import { PlanResponseDto } from '../../dto/response/planning.response.dto';
export interface IPlanningService {
    createPlan(dto: CreatePlanRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
    addPlanItem(planId: string, dto: AddPlanItemRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
    removePlanItem(planId: string, itemId: string, actor: ActorContext): Promise<void>;
    submitPlanForApproval(planId: string, actor: ActorContext): Promise<PlanResponseDto>;
    approvePlan(planId: string, actor: ActorContext): Promise<PlanResponseDto>;
    rejectPlan(planId: string, reason: string, actor: ActorContext): Promise<PlanResponseDto>;
    getPlanById(id: string): Promise<PlanResponseDto>;
    listPlans(query: PlanQueryDto): Promise<{
        plans: PlanResponseDto[];
        meta: PaginationMeta;
    }>;
}
//# sourceMappingURL=planning.service.interface.d.ts.map