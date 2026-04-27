import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { CreateRiskRequestDto, RiskRegisterQueryDto, UpdateRiskRequestDto, UpdateRiskStatusRequestDto } from '../../dto/request/register.request.dto';
import { RiskRegisterResponseDto } from '../../dto/response/register.response.dto';
export interface IRegisterService {
    createRisk(dto: CreateRiskRequestDto, actor: RiskActorContext): Promise<RiskRegisterResponseDto>;
    updateRisk(id: string, dto: UpdateRiskRequestDto, actor: RiskActorContext): Promise<RiskRegisterResponseDto>;
    updateRiskStatus(id: string, dto: UpdateRiskStatusRequestDto, actor: RiskActorContext): Promise<RiskRegisterResponseDto>;
    deleteRisk(id: string, actor: RiskActorContext): Promise<void>;
    getRiskById(id: string, actor: RiskActorContext): Promise<RiskRegisterResponseDto>;
    listRisks(query: RiskRegisterQueryDto, actor: RiskActorContext): Promise<{
        risks: RiskRegisterResponseDto[];
        meta: PaginationMeta;
    }>;
    getRisksByUniverseEntity(universeId: string, actor?: RiskActorContext): Promise<RiskRegisterResponseDto[]>;
}
//# sourceMappingURL=register.service.interface.d.ts.map