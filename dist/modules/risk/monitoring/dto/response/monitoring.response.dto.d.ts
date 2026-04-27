import { RiskBandSummary, RiskScoreTrendPoint, RiskStatusSummary } from '../../../domain/entity/risk.entity';
export interface OrganizationRiskSummaryResponseDto {
    byScoreBand: RiskBandSummary;
    byStatus: RiskStatusSummary;
    total: number;
}
export type RiskScoreTrendResponseDto = RiskScoreTrendPoint;
//# sourceMappingURL=monitoring.response.dto.d.ts.map