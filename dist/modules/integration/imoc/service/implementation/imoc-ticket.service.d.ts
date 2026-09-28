import { IEvidenceService } from '../../../../audit/evidence/service/interface/evidence.service.interface';
import { ActorContext } from '../../../../audit/domain/entity/audit.entity';
import { ImocIntegrationStatus, ImocModelSummary, ImocTicket, ImocTicketLookup, ImocTicketPage, ImocTicketSearch } from '../../domain/entity/imoc.entity';
import { ImocTicketLinkResponseDto, ImocTicketSnapshotResponseDto } from '../../dto/response/imoc.response.dto';
import { IImocClient } from '../client/imoc.client';
import { IImocTicketService } from '../interface/imoc-ticket.service.interface';
export declare class ImocTicketService implements IImocTicketService {
    private readonly client;
    private readonly evidenceService?;
    constructor(client: IImocClient, evidenceService?: IEvidenceService | undefined);
    getStatus(): Promise<ImocIntegrationStatus>;
    searchTickets(query: ImocTicketSearch, actor: ActorContext): Promise<ImocTicketPage>;
    getTicket(lookup: ImocTicketLookup, actor: ActorContext): Promise<ImocTicket>;
    getModel(modelId: string, actor: ActorContext): Promise<ImocModelSummary>;
    listLinks(engagementId: string, actor: ActorContext): Promise<ImocTicketLinkResponseDto[]>;
    getLink(id: string): Promise<ImocTicketLinkResponseDto>;
    linkTicket(engagementId: string, lookup: ImocTicketLookup, actor: ActorContext): Promise<ImocTicketLinkResponseDto>;
    unlinkTicket(id: string, actor: ActorContext): Promise<void>;
    refreshLink(id: string, actor: ActorContext): Promise<ImocTicketLinkResponseDto>;
    captureSnapshot(id: string, actor: ActorContext): Promise<ImocTicketSnapshotResponseDto>;
    listSnapshots(id: string, actor: ActorContext): Promise<ImocTicketSnapshotResponseDto[]>;
    syncActiveLinks(limit: number): Promise<{
        refreshed: number;
        failed: number;
    }>;
    private _refreshLink;
    private _updateLinkFromTicket;
    private _getActiveLink;
}
export declare const imocTicketService: ImocTicketService;
//# sourceMappingURL=imoc-ticket.service.d.ts.map