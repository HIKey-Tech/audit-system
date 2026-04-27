import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { RiskActorContext } from '../../../domain/entity/risk.entity';
import { CreateRiskAssessmentRequestDto, RiskAssessmentQueryDto } from '../../dto/request/assessment.request.dto';
import { RiskAssessmentResponseDto } from '../../dto/response/assessment.response.dto';
export interface IAssessmentService {
    createAssessment(riskId: string, dto: CreateRiskAssessmentRequestDto, actor: RiskActorContext): Promise<RiskAssessmentResponseDto>;
    getAssessmentById(id: string, actor: RiskActorContext): Promise<RiskAssessmentResponseDto>;
    listAssessments(riskId: string, query: RiskAssessmentQueryDto, actor: RiskActorContext): Promise<{
        assessments: RiskAssessmentResponseDto[];
        meta: PaginationMeta;
    }>;
    getLatestAssessment(riskId: string, actor: RiskActorContext): Promise<RiskAssessmentResponseDto | null>;
}
//# sourceMappingURL=assessment.service.interface.d.ts.map