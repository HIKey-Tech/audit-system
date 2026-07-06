import { ActorContext } from '../../../domain/entity/audit.entity';
import { LogTimeEntryDto } from '../../dto/request/time-entry.request.dto';
import { EngagementTimeSummaryDto, TimeEntryResponseDto } from '../../dto/response/time-entry.response.dto';
import { ITimeEntryService } from '../interface/time-entry.service.interface';
export declare class TimeEntryService implements ITimeEntryService {
    logTime(engagementId: string, dto: LogTimeEntryDto, actor: ActorContext): Promise<TimeEntryResponseDto>;
    listForEngagement(engagementId: string, actor: ActorContext): Promise<EngagementTimeSummaryDto>;
    deleteEntry(entryId: string, actor: ActorContext): Promise<void>;
    private _getEngagement;
    private _assertIsTeamOrOversight;
}
//# sourceMappingURL=time-entry.service.d.ts.map