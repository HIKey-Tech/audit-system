import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { AddPlanItemRequestDto, BulkAddPlanItemsRequestDto, CreatePlanRequestDto, PlanQueryDto, UpdatePlanItemRequestDto, UpdatePlanRequestDto } from '../../dto/request/planning.request.dto';
import { PlanResponseDto } from '../../dto/response/planning.response.dto';
import { IPlanningService, PlanUniverseCandidateDto, PlanningRecommendationDto } from '../interface/planning.service.interface';
export declare class PlanningService implements IPlanningService {
    private readonly approvalService;
    constructor(approvalService?: IApprovalService);
    /**
     * Composite audit-priority ranking over the active audit universe — the
     * defensible "what should we audit next year" list. Each signal is scored
     * 0-100 and blended with admin-configurable weights
     * (system_config.planning_priority_weights), so GBB decides what "priority"
     * means without a redeploy. The per-entity component breakdown and reasons
     * are returned so the ranking is explainable, not a black box.
     */
    getRecommendations(): Promise<PlanningRecommendationDto[]>;
    /**
     * Returns all active audit universe entities enriched with due-cycle classification,
     * recommended priority, owners, and existing coverage within the target programme's year.
     */
    getUniverseCandidates(planId: string): Promise<PlanUniverseCandidateDto[]>;
    createPlan(dto: CreatePlanRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
    updatePlan(planId: string, dto: UpdatePlanRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
    deletePlan(planId: string, actor: ActorContext): Promise<void>;
    addPlanItem(planId: string, dto: AddPlanItemRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
    bulkAddPlanItems(planId: string, dto: BulkAddPlanItemsRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
    updatePlanItem(planId: string, itemId: string, dto: UpdatePlanItemRequestDto, actor: ActorContext): Promise<PlanResponseDto>;
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
    private _assertUniverseActive;
}
//# sourceMappingURL=planning.service.d.ts.map