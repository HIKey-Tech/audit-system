import { ActorContext } from '../../../domain/entity/audit.entity';
import { LogTimeEntryDto } from '../../dto/request/time-entry.request.dto';
import { EngagementTimeSummaryDto, TimeEntryResponseDto } from '../../dto/response/time-entry.response.dto';
export interface ITimeEntryService {
    logTime(engagementId: string, dto: LogTimeEntryDto, actor: ActorContext): Promise<TimeEntryResponseDto>;
    listForEngagement(engagementId: string, actor: ActorContext): Promise<EngagementTimeSummaryDto>;
    deleteEntry(entryId: string, actor: ActorContext): Promise<void>;
}
//# sourceMappingURL=time-entry.service.interface.d.ts.map