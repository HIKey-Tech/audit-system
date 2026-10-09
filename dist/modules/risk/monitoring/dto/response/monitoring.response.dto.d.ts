import { RiskBandSummary, RiskScoreTrendPoint, RiskStatusSummary } from '../../../domain/entity/risk.entity';
export interface OrganizationRiskSummaryResponseDto {
    byScoreBand: RiskBandSummary;
    byStatus: RiskStatusSummary;
    total: number;
}
export type RiskScoreTrendResponseDto = RiskScoreTrendPoint;
/** A risk that is new, or whose score has risen, within the look-back window. */
export interface EmergingRiskResponseDto {
    riskId: string;
    title: string;
    categoryName: string | null;
    ownerName: string | null;
    trend: 'new' | 'rising';
    currentScore: number;
    previousScore: number | null;
    change: number;
    status: string;
    lastAssessedAt: string | null;
}
//# sourceMappingURL=monitoring.response.dto.d.ts.map