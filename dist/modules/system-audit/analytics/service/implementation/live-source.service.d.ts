import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IAuditLogService } from '../../../../logging/service/interface/audit-log.service.interface';
import { IImocTicketService } from '../../../../integration/imoc/service/interface/imoc-ticket.service.interface';
import { IDirectoryMappingService } from '../../../../integration/service/interface/directory.service.interface';
import { SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { AnalysisSource, AnalysisType } from '../../../domain/enum/system-audit.enum';
import { ILiveSourceService, LiveExtract } from '../interface/live-source.service.interface';
export declare class LiveSourceService implements ILiveSourceService {
    private readonly userService;
    private readonly auditLogService;
    private readonly imocTicketService;
    private readonly directoryService;
    constructor(userService: IUserService, auditLogService: IAuditLogService, imocTicketService: IImocTicketService, directoryService: IDirectoryMappingService);
    supportedSources(): Partial<Record<AnalysisType, AnalysisSource[]>>;
    fetch(type: AnalysisType, source: AnalysisSource, options: {
        days: number;
        actor: SystemAuditActor;
    }): Promise<LiveExtract>;
    private _iamsAccess;
    private _entraAccess;
    private _iamsSecurityEvents;
    private _imocIncidents;
}
//# sourceMappingURL=live-source.service.d.ts.map