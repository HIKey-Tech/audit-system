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
export interface ImocRealStatusResponseDto {
    reachable: boolean;
    authenticated: boolean;
    lastError: string | null;
    checkedAt: string;
}
export interface ImocIngestionRuleResponseDto {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    priority: number;
    criteria: Record<string, unknown>;
    category: string | null;
    riskCategoryId: string | null;
    lookbackDays: number;
    lastRunAt: string | null;
    lastRunStatus: string | null;
    lastRunFetched: number | null;
    lastRunIngested: number | null;
    lastRunError: string | null;
    createdById: string;
    updatedById: string | null;
    createdAt: string;
    updatedAt: string;
}
export declare const mapImocRuleToResponse: (rule: any) => ImocIngestionRuleResponseDto;
export interface ImocIngestionRunResponseDto {
    id: string;
    trigger: string;
    triggeredById: string | null;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    rulesEvaluated: number;
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errorSummary: string | null;
    createdAt: string;
}
export declare const mapImocRunToResponse: (run: any) => ImocIngestionRunResponseDto;
export interface ImocStoredTicketResponseDto {
    id: string;
    orderId: string;
    orderNumber: string;
    orderName: string | null;
    modelId: string | null;
    modelName: string | null;
    modelType: string | null;
    orderSource: string | null;
    orderStatus: string | null;
    slaStatus: string | null;
    priority: string | null;
    currentHandler: string | null;
    createdByName: string | null;
    imocCreatedAt: string | null;
    imocEndedAt: string | null;
    category: string | null;
    matchedRuleIds: string[];
    matchedRuleNames?: string[];
    linkedEngagementCount: number;
    linkedRiskCount: number;
    firstIngestedAt: string;
    lastSyncedAt: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export declare const mapImocStoredTicketToResponse: (ticket: any, ruleNameMap?: Map<string, string>) => ImocStoredTicketResponseDto;
export interface ImocSavedViewResponseDto {
    id: string;
    name: string;
    filters: Record<string, unknown>;
    ownerId: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}
export declare const mapImocSavedViewToResponse: (view: any) => ImocSavedViewResponseDto;
export interface ImocTicketRiskLinkResponseDto {
    id: string;
    imocTicketId: string;
    riskId: string;
    notes: string | null;
    createdById: string;
    createdAt: string;
    risk?: {
        id: string;
        title: string;
        status: string;
        currentScore: number;
    };
}
export declare const mapImocRiskLinkToResponse: (link: any) => ImocTicketRiskLinkResponseDto;
//# sourceMappingURL=imoc.response.dto.d.ts.map