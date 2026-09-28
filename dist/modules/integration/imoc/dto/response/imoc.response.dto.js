"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketLinkFields = exports.mapImocSnapshotToResponse = exports.mapImocTicketLinkToResponse = void 0;
const mapImocTicketLinkToResponse = (link) => ({
    id: link.id,
    engagementId: link.engagement_id,
    orderId: link.order_id,
    orderNumber: link.order_number,
    orderName: link.order_name,
    modelId: link.model_id,
    modelName: link.model_name,
    modelType: link.model_type,
    lastStatus: link.last_status,
    lastSlaStatus: link.last_sla_status,
    lastStepName: link.last_step_name,
    lastStepSequence: link.last_step_sequence,
    lastSyncedAt: link.last_synced_at?.toISOString() ?? null,
    lastSyncError: link.last_sync_error,
    isActive: link.is_active,
    createdAt: link.created_at.toISOString(),
    updatedAt: link.updated_at.toISOString(),
});
exports.mapImocTicketLinkToResponse = mapImocTicketLinkToResponse;
const mapImocSnapshotToResponse = (snapshot) => ({
    id: snapshot.id,
    ticketLinkId: snapshot.imoc_ticket_link_id,
    auditEvidenceId: snapshot.audit_evidence_id,
    status: snapshot.status,
    slaStatus: snapshot.sla_status,
    payloadSha256: snapshot.payload_sha256,
    sourceRetrievedAt: snapshot.source_retrieved_at.toISOString(),
    capturedById: snapshot.captured_by_id,
    createdAt: snapshot.created_at.toISOString(),
});
exports.mapImocSnapshotToResponse = mapImocSnapshotToResponse;
const ticketLinkFields = (ticket) => ({
    order_id: ticket.orderId,
    order_number: ticket.orderNumber,
    order_name: ticket.orderName,
    model_id: ticket.modelId,
    model_name: ticket.modelName,
    model_type: ticket.modelType,
    last_status: ticket.orderStatus,
    last_sla_status: ticket.slaStatus,
    last_step_name: ticket.currentStepName,
    last_step_sequence: ticket.currentStepSequence,
    last_synced_at: new Date(ticket.retrievedAt),
    last_sync_error: null,
});
exports.ticketLinkFields = ticketLinkFields;
//# sourceMappingURL=imoc.response.dto.js.map