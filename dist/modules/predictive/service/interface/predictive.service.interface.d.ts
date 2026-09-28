import { ActorContext } from '../../../audit/domain/entity/audit.entity';
import { InsightFeedbackDto } from '../../dto/request/predictive.request.dto';
import { PredictiveOverviewResponseDto, PredictiveRefreshResponseDto } from '../../dto/response/predictive.response.dto';
export interface IPredictiveService {
    getOverview(actor: ActorContext): Promise<PredictiveOverviewResponseDto>;
    recordFeedback(insightId: string, dto: InsightFeedbackDto, actor: ActorContext): Promise<void>;
    refreshInsights(): Promise<PredictiveRefreshResponseDto>;
}
//# sourceMappingURL=predictive.service.interface.d.ts.map