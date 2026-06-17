import { ActorContext } from '../../../domain/entity/audit.entity';
import { ControlQueryDto, CreateControlRequestDto, CreateFrameworkRequestDto, UpdateControlRequestDto, UpdateFrameworkRequestDto } from '../../dto/request/compliance.request.dto';
import { ComplianceCoverageDto, ControlResponseDto, ControlRiskDto, FrameworkResponseDto, RiskCoverageDto, TestedCoverageDto } from '../../dto/response/compliance.response.dto';
import { PaginationMeta } from '../../../../../shared/types/api-response.type';
export interface IComplianceService {
    listFrameworks(): Promise<FrameworkResponseDto[]>;
    createFramework(dto: CreateFrameworkRequestDto, actor: ActorContext): Promise<FrameworkResponseDto>;
    updateFramework(id: string, dto: UpdateFrameworkRequestDto, actor: ActorContext): Promise<FrameworkResponseDto>;
    getCoverage(): Promise<ComplianceCoverageDto>;
    getTestedCoverage(): Promise<TestedCoverageDto>;
    listControls(query: ControlQueryDto): Promise<{
        controls: ControlResponseDto[];
        meta: PaginationMeta;
    }>;
    createControl(dto: CreateControlRequestDto, actor: ActorContext): Promise<ControlResponseDto>;
    updateControl(id: string, dto: UpdateControlRequestDto, actor: ActorContext): Promise<ControlResponseDto>;
    deleteControl(id: string, actor: ActorContext): Promise<void>;
    listControlRisks(controlId: string): Promise<ControlRiskDto[]>;
    linkRisk(controlId: string, riskId: string, actor: ActorContext): Promise<ControlRiskDto[]>;
    unlinkRisk(controlId: string, riskId: string, actor: ActorContext): Promise<void>;
    getRiskCoverage(): Promise<RiskCoverageDto>;
}
//# sourceMappingURL=compliance.service.interface.d.ts.map