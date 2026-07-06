import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { AddPlanItemRequestDto, CreatePlanRequestDto, PlanQueryDto, UpdatePlanRequestDto } from '../../dto/request/planning.request.dto';
import { PlanResponseDto } from '../../dto/response/planning.response.dto';
/** One universe entity's composite audit-priority score with its rationale. */
export interface PlanningRecommendationDto {
    universeId: string;
    name: string;
    category: string;
    riskScore: number;
    auditFrequency: string;
    lastAuditedAt: string | null;
    openFindingsCount: number;
    /** 0-100 composite priority (weights from system_config.planning_priority_weights). */
    score: number;
    /** 0-100 per-signal components behind the score, for the UI breakdown. */
    components: {
        riskScore: number;
        openFindings: number;
        overdueForAudit: number;
        neverAudited: number;
        timeSinceLastAudit: number;
    };
    /** Human-readable "why this entity" bullets. */
    reasons: string[];
}
export interface IPlanningService {
    getRecommendations(): Promise<PlanningRecommendationDto[]>;
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
}
//# sourceMappingURL=planning.service.interface.d.ts.map