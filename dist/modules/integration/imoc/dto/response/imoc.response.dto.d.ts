import { Imoc_Ticket_Link, Imoc_Ticket_Snapshot } from '@prisma/client';
import { ImocTicket } from '../../domain/entity/imoc.entity';
export interface ImocTicketLinkResponseDto {
    id: string;
    engagementId: string;
    orderId: string;
    orderNumber: string;
    orderName: string | null;
    modelId: string | null;
    modelName: string | null;
    modelType: string | null;
    lastStatus: string | null;
    lastSlaStatus: string | null;
    lastStepName: string | null;
    lastStepSequence: number | null;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ImocTicketSnapshotResponseDto {
    id: string;
    ticketLinkId: string;
    auditEvidenceId: string | null;
    status: string | null;
    slaStatus: string | null;
    payloadSha256: string;
    sourceRetrievedAt: string;
    capturedById: string;
    createdAt: string;
}
export declare const mapImocTicketLinkToResponse: (link: Imoc_Ticket_Link) => ImocTicketLinkResponseDto;
export declare const mapImocSnapshotToResponse: (snapshot: Imoc_Ticket_Snapshot) => ImocTicketSnapshotResponseDto;
export declare const ticketLinkFields: (ticket: ImocTicket) => {
    order_id: string;
    order_number: string;
    order_name: string | null;
    model_id: string | null;
    model_name: string | null;
    model_type: string | null;
    last_status: string | null;
    last_sla_status: string | null;
    last_step_name: string | null;
    last_step_sequence: number | null;
    last_synced_at: Date;
    last_sync_error: null;
};
//# sourceMappingURL=imoc.response.dto.d.ts.map