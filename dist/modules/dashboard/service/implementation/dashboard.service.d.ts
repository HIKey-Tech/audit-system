import { DashboardActorContext } from '../../domain/entity/dashboard.entity';
import { ApprovalInboxSummaryResponseDto, AuditSummaryResponseDto, EscalationOverviewResponseDto, FindingsSummaryResponseDto, MyWorkResponseDto, RecentActivityItemDto, RiskOverviewResponseDto } from '../../dto/response/dashboard.response.dto';
export declare class DashboardService {
    getAuditSummary(actor: DashboardActorContext): Promise<AuditSummaryResponseDto>;
    getFindingsSummary(actor: DashboardActorContext): Promise<FindingsSummaryResponseDto>;
    getRiskOverview(_actor: DashboardActorContext): Promise<RiskOverviewResponseDto>;
    getRecentActivity(actor: DashboardActorContext, limit: number): Promise<RecentActivityItemDto[]>;
    getEscalationOverview(actor: DashboardActorContext): Promise<EscalationOverviewResponseDto>;
    getMyWork(userId: string): Promise<MyWorkResponseDto>;
    getApprovalInboxSummary(userId: string): Promise<ApprovalInboxSummaryResponseDto>;
    private _averageDaysToCloseRaw;
    private _activeEscalationCondition;
    private _pendingApprovalStepsForUserRaw;
}
export declare const dashboardService: DashboardService;
//# sourceMappingURL=dashboard.service.d.ts.map