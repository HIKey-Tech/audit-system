import { TabularExportFile } from '../../../../../shared/utils/tabular-export.util';
import { ImocStoredSummary } from '../../domain/entity/imoc.entity';
import {
  CreateSavedViewDto,
  CreateTicketRiskLinkDto,
  ListStoredTicketsQueryDto,
  UpdateSavedViewDto,
} from '../../dto/request/imoc.request.dto';
import {
  ImocSavedViewResponseDto,
  ImocStoredTicketResponseDto,
  ImocTicketRiskLinkResponseDto,
} from '../../dto/response/imoc.response.dto';

export interface StoredTicketDetailResponseDto extends ImocStoredTicketResponseDto {
  linkedEngagements: Array<{
    linkId: string;
    engagementId: string;
    engagementTitle: string;
    engagementCode: string;
    isActive: boolean;
    linkedAt: string;
  }>;
  snapshots: Array<{
    id: string;
    status: string | null;
    slaStatus: string | null;
    payloadSha256: string;
    capturedAt: string;
    capturedById: string;
  }>;
  linkedRisks: Array<{
    id: string;
    riskId: string;
    title: string;
    status: string;
    currentScore: number;
    notes: string | null;
    linkedAt: string;
  }>;
}

export interface IImocStoreService {
  listStoredTickets(
    query: ListStoredTicketsQueryDto,
  ): Promise<{
    items: ImocStoredTicketResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;

  getStoredSummary(
    query: Partial<ListStoredTicketsQueryDto>,
  ): Promise<ImocStoredSummary>;

  getStoredTicket(id: string): Promise<StoredTicketDetailResponseDto>;

  exportStoredTickets(
    query: ListStoredTicketsQueryDto,
    format?: 'csv' | 'xlsx',
  ): Promise<TabularExportFile>;

  listSavedViews(ownerId: string): Promise<ImocSavedViewResponseDto[]>;

  createSavedView(
    ownerId: string,
    data: CreateSavedViewDto,
  ): Promise<ImocSavedViewResponseDto>;

  updateSavedView(
    ownerId: string,
    id: string,
    data: UpdateSavedViewDto,
  ): Promise<ImocSavedViewResponseDto>;

  deleteSavedView(ownerId: string, id: string): Promise<void>;

  linkTicketToRisk(
    actor: any,
    data: CreateTicketRiskLinkDto,
  ): Promise<ImocTicketRiskLinkResponseDto>;

  unlinkTicketRisk(actorId: string, ticketId: string, riskId: string): Promise<void>;
}
