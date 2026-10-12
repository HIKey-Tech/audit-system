import { ActorContext } from '../../../../audit/domain/entity/audit.entity';
import { ImocIntegrationStatus, ImocModelSummary, ImocStoredTicket, ImocTicket, ImocTicketLookup, ImocTicketPage, ImocTicketSearch } from '../../domain/entity/imoc.entity';
import { ImocTicketLinkResponseDto, ImocTicketSnapshotResponseDto, ImocRealStatusResponseDto } from '../../dto/response/imoc.response.dto';
export interface IImocTicketService {
    getStatus(): Promise<ImocIntegrationStatus>;
    checkStatus(): Promise<ImocRealStatusResponseDto>;
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
    listStoredTickets(query: {
        createdFrom?: string;
        category?: string[];
    }, actor: ActorContext): Promise<ImocStoredTicket[]>;
}
//# sourceMappingURL=imoc-ticket.service.interface.d.ts.map