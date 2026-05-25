import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { AddPlanItemRequestDto, CreatePlanRequestDto, PlanQueryDto, UpdatePlanRequestDto } from '../../dto/request/planning.request.dto';
import { PlanResponseDto } from '../../dto/response/planning.response.dto';
import { IPlanningService } from '../interface/planning.service.interface';
export declare class PlanningService implements IPlanningService {
    private readonly approvalService;
    constructor(approvalService?: IApprovalService);
    createPlan(dto: CreatePlanRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
    updatePlan(planId: string, dto: UpdatePlanRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
    deletePlan(planId: string, actor: ActorContext): Promise<void>;
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
    private _getPlanForMutation;
    private _assertDraftPlan;
    private _assertUniverseExists;
}
//# sourceMappingURL=planning.service.d.ts.map