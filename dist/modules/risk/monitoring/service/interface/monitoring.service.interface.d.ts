import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { EmergingRiskQueryDto, HighRiskQueryDto } from '../../dto/request/monitoring.request.dto';
import { EmergingRiskResponseDto, OrganizationRiskSummaryResponseDto, RiskScoreTrendResponseDto } from '../../dto/response/monitoring.response.dto';
import { RiskRegisterResponseDto } from '../../../register/dto/response/register.response.dto';
export interface IMonitoringService {
    getHighRiskItems(query: HighRiskQueryDto, actor: RiskActorContext): Promise<{
        risks: RiskRegisterResponseDto[];
        meta: PaginationMeta;
    }>;
    getRisksRequiringAttention(actor: RiskActorContext): Promise<RiskRegisterResponseDto[]>;
    getRiskScoreTrend(riskId: string, actor: RiskActorContext): Promise<RiskScoreTrendResponseDto[]>;
    getOrganizationRiskSummary(actor: RiskActorContext): Promise<OrganizationRiskSummaryResponseDto>;
    /** New risks and risks whose score rose within the window — the emerging-risk watchlist. */
    getEmergingRisks(query: EmergingRiskQueryDto, actor: RiskActorContext): Promise<EmergingRiskResponseDto[]>;
}
//# sourceMappingURL=monitoring.service.interface.d.ts.map