export interface EngagementStatusBreakdown {
    planned: number;
    in_progress: number;
    under_review: number;
    reported: number;
    closed: number;
}
export interface AuditSummaryResponseDto {
    totalEngagementsThisYear: number;
    byStatus: EngagementStatusBreakdown;
    overdueEngagements: number;
    dueSoon: number;
    completionRate: number;
    totalPlansThisYear: number;
    approvedPlans: number;
}
export interface FindingSeverityBreakdown {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
}
export interface FindingStatusBreakdown {
    open: number;
    management_response_received: number;
    in_remediation: number;
    verified: number;
    pending_closure: number;
    closed: number;
}
export interface FindingsSummaryResponseDto {
    totalOpen: number;
    bySeverity: FindingSeverityBreakdown;
    byStatus: FindingStatusBreakdown;
    overdue: number;
    averageDaysToClose: number | null;
    resolvedThisMonth: number;
}
export interface RiskScoreBandBreakdown {
    critical: number;
    high: number;
    medium: number;
    low: number;
}
export interface RiskStatusBreakdown {
    open: number;
    mitigated: number;
    accepted: number;
    closed: number;
}
export interface TopRiskItemDto {
    id: string;
    title: string;
    score: number;
    status: string;
    categoryName: string;
    ownerName: string;
}
export interface RiskOverviewResponseDto {
    totalRisks: number;
    byScoreBand: RiskScoreBandBreakdown;
    byStatus: RiskStatusBreakdown;
    topFiveRisks: TopRiskItemDto[];
    staleRisks: number;
}
export interface RiskMatrixCellDto {
    likelihood: number;
    impact: number;
    score: number;
    count: number;
}
export interface RiskMatrixResponseDto {
    cells: RiskMatrixCellDto[];
    totalPlotted: number;
}
export interface RecentActivityItemDto {
    id: string;
    action: string;
    module: string;
    entityType: string | null;
    entityId: string | null;
    status: string;
    userId: string | null;
    createdAt: string;
}
export interface EscalationLevelBreakdown {
    level1: number;
    level2: number;
    level3: number;
    level4: number;
}
export interface RecentEscalationItemDto {
    id: string;
    entityType: string;
    entityId: string;
    escalationLevel: number;
    reason: string;
    notifiedUserName: string;
    notifiedAt: string;
}
export interface EscalationOverviewResponseDto {
    totalActive: number;
    byLevel: EscalationLevelBreakdown;
    recentEscalations: RecentEscalationItemDto[];
}
export interface MyEngagementItemDto {
    id: string;
    title: string;
    referenceNumber: string;
    status: string;
    slaDeadline: string;
    priority: string;
}
export interface MyPendingApprovalItemDto {
    stepId: string;
    approvalId: string;
    entityType: string;
    entityId: string;
    currentLevel: number;
    createdAt: string;
}
export interface MyFindingToVerifyDto {
    id: string;
    title: string;
    severity: string;
    status: string;
    dueDate: string;
    engagementId: string;
    engagementReference: string;
}
export interface MyWorkResponseDto {
    myActiveEngagements: MyEngagementItemDto[];
    myPendingApprovals: MyPendingApprovalItemDto[];
    myOverdueEngagements: MyEngagementItemDto[];
    myFindingsToVerify: MyFindingToVerifyDto[];
}
export interface ApprovalInboxSummaryResponseDto {
    pendingCount: number;
    oldestPendingDays: number;
    requestPendingCount: number;
}
export interface AnalyticsCountBreakdown {
    [key: string]: number;
}
export interface LifecycleAnalyticsDto {
    byStatus: EngagementStatusBreakdown;
    overdueEngagements: number;
    dueSoon: number;
    averageCycleDays: number | null;
    averageFieldworkDays: number | null;
    averageReportingDays: number | null;
}
export interface WorkPaperAnalyticsDto {
    total: number;
    imported: number;
    byStatus: AnalyticsCountBreakdown;
    submittedAwaitingReview: number;
}
export interface ReportingAnalyticsDto {
    total: number;
    byStatus: AnalyticsCountBreakdown;
    averageDaysToIssue: number | null;
}
export interface FollowUpAnalyticsDto {
    total: number;
    pending: number;
    verified: number;
    rejected: number;
    overdueFindings: number;
}
export interface RiskCoverageAnalyticsDto {
    universeItems: number;
    highRiskUniverseItems: number;
    highRiskAuditedThisYear: number;
    highRiskCoverageRate: number;
}
export interface AuditAnalyticsResponseDto {
    generatedAt: string;
    lifecycle: LifecycleAnalyticsDto;
    workingPapers: WorkPaperAnalyticsDto;
    findings: FindingsSummaryResponseDto;
    reporting: ReportingAnalyticsDto;
    followUp: FollowUpAnalyticsDto;
    riskCoverage: RiskCoverageAnalyticsDto;
}
//# sourceMappingURL=dashboard.response.dto.d.ts.map