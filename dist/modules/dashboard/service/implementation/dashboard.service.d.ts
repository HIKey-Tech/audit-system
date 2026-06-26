import { DashboardActorContext } from '../../domain/entity/dashboard.entity';
import { ApprovalInboxSummaryResponseDto, AuditAnalyticsResponseDto, AuditSummaryResponseDto, EscalationOverviewResponseDto, FindingsSummaryResponseDto, MyWorkResponseDto, RecentActivityItemDto, RiskMatrixResponseDto, RiskOverviewResponseDto } from '../../dto/response/dashboard.response.dto';
export declare class DashboardService {
    getAuditAnalytics(actor: DashboardActorContext): Promise<AuditAnalyticsResponseDto>;
    private _computeAuditAnalytics;
    getAuditSummary(actor: DashboardActorContext): Promise<AuditSummaryResponseDto>;
    getFindingsSummary(actor: DashboardActorContext): Promise<FindingsSummaryResponseDto>;
    getRiskOverview(_actor: DashboardActorContext): Promise<RiskOverviewResponseDto>;
    getRiskMatrix(): Promise<RiskMatrixResponseDto>;
    private _computeRiskMatrix;
    getRecentActivity(actor: DashboardActorContext, limit: number): Promise<RecentActivityItemDto[]>;
    getEscalationOverview(actor: DashboardActorContext): Promise<EscalationOverviewResponseDto>;
    getMyWork(userId: string): Promise<MyWorkResponseDto>;
    getApprovalInboxSummary(userId: string): Promise<ApprovalInboxSummaryResponseDto>;
    private _averageDaysToCloseRaw;
    private _activeEscalationCondition;
    private _pendingApprovalStepsForUserRaw;
    private _getLifecycleAnalytics;
    private _getWorkingPaperAnalytics;
    private _getReportingAnalytics;
    private _getFollowUpAnalytics;
    private _getRiskCoverageAnalytics;
}
export declare const dashboardService: DashboardService;
//# sourceMappingURL=dashboard.service.d.ts.map