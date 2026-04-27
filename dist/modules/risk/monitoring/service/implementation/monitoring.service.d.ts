import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { HighRiskQueryDto } from '../../dto/request/monitoring.request.dto';
import { OrganizationRiskSummaryResponseDto, RiskScoreTrendResponseDto } from '../../dto/response/monitoring.response.dto';
import { RiskRegisterResponseDto } from '../../../register/dto/response/register.response.dto';
import { IMonitoringService } from '../interface/monitoring.service.interface';
export declare class RiskMonitoringService implements IMonitoringService {
    getHighRiskItems(query: HighRiskQueryDto, actor: RiskActorContext): Promise<{
        risks: RiskRegisterResponseDto[];
        meta: PaginationMeta;
    }>;
    getRisksRequiringAttention(actor: RiskActorContext): Promise<RiskRegisterResponseDto[]>;
    getRiskScoreTrend(riskId: string, actor: RiskActorContext): Promise<RiskScoreTrendResponseDto[]>;
    getOrganizationRiskSummary(actor: RiskActorContext): Promise<OrganizationRiskSummaryResponseDto>;
}
//# sourceMappingURL=monitoring.service.d.ts.map