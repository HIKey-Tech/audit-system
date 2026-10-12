import { PrismaClient } from '@prisma/client';
import { TabularExportFile } from '../../../../../shared/utils/tabular-export.util';
import { IRegisterService } from '../../../../risk/register/service/interface/register.service.interface';
import { ImocStoredSummary } from '../../domain/entity/imoc.entity';
import { CreateSavedViewDto, CreateTicketRiskLinkDto, ListStoredTicketsQueryDto, UpdateSavedViewDto } from '../../dto/request/imoc.request.dto';
import { ImocSavedViewResponseDto, ImocStoredTicketResponseDto, ImocTicketRiskLinkResponseDto } from '../../dto/response/imoc.response.dto';
import { IImocStoreService, StoredTicketDetailResponseDto } from '../interface/imoc-store.service.interface';
export declare class ImocStoreService implements IImocStoreService {
    private readonly prisma;
    private readonly riskService;
    constructor(prisma?: PrismaClient, riskService?: IRegisterService);
    private _buildWhere;
    listStoredTickets(query: ListStoredTicketsQueryDto): Promise<{
        items: ImocStoredTicketResponseDto[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;
    getStoredSummary(query: Partial<ListStoredTicketsQueryDto>): Promise<ImocStoredSummary>;
    getStoredTicket(id: string): Promise<StoredTicketDetailResponseDto>;
    exportStoredTickets(query: ListStoredTicketsQueryDto, format?: 'csv' | 'xlsx'): Promise<TabularExportFile>;
    listSavedViews(ownerId: string): Promise<ImocSavedViewResponseDto[]>;
    createSavedView(ownerId: string, data: CreateSavedViewDto): Promise<ImocSavedViewResponseDto>;
    updateSavedView(ownerId: string, id: string, data: UpdateSavedViewDto): Promise<ImocSavedViewResponseDto>;
    deleteSavedView(ownerId: string, id: string): Promise<void>;
    linkTicketToRisk(actor: any, data: CreateTicketRiskLinkDto): Promise<ImocTicketRiskLinkResponseDto>;
    unlinkTicketRisk(actorId: string, ticketId: string, riskId: string): Promise<void>;
}
export declare const imocStoreService: ImocStoreService;
//# sourceMappingURL=imoc-store.service.d.ts.map