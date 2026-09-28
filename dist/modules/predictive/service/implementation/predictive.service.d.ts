import { ActorContext } from '../../../audit/domain/entity/audit.entity';
import { InsightFeedbackDto } from '../../dto/request/predictive.request.dto';
import { PredictiveOverviewResponseDto, PredictiveRefreshResponseDto } from '../../dto/response/predictive.response.dto';
import { IPredictiveService } from '../interface/predictive.service.interface';
import { IWarehouseService } from '../../../warehouse/service/interface/warehouse.service.interface';
export declare class PredictiveService implements IPredictiveService {
    private readonly warehouse;
    constructor(warehouse: IWarehouseService);
    getOverview(actor: ActorContext): Promise<PredictiveOverviewResponseDto>;
    recordFeedback(insightId: string, dto: InsightFeedbackDto, actor: ActorContext): Promise<void>;
    refreshInsights(): Promise<PredictiveRefreshResponseDto>;
    private _getVisibleInsights;
    private _canViewInsight;
}
//# sourceMappingURL=predictive.service.d.ts.map