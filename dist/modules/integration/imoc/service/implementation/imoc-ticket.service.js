"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imocTicketService = exports.ImocTicketService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const app_config_1 = require("../../../../../shared/config/app.config");
const imoc_response_dto_1 = require("../../dto/response/imoc.response.dto");
const imoc_client_1 = require("../client/imoc.client");
const imoc_utility_1 = require("../../utility/imoc.utility");
const assertPermission = (actor, permission) => {
    if (!actor.permissions.includes(permission)) {
        throw app_error_1.AppError.forbidden(`Missing required permission: ${permission}`);
    }
};
class ImocTicketService {
    client;
    evidenceService;
    constructor(client, evidenceService) {
        this.client = client;
        this.evidenceService = evidenceService;
    }
    async getStatus() {
        const [linkedTicketCount, latestLink] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.imoc_Ticket_Link.count({ where: { deleted_at: null, is_active: true } }),
            prisma_client_1.prisma.imoc_Ticket_Link.findFirst({
                where: { deleted_at: null, last_synced_at: { not: null } },
                orderBy: { last_synced_at: 'desc' },
                select: { last_synced_at: true },
            }),
        ]);
        return {
            enabled: this.client.enabled,
            configured: this.client.configured,
            syncEnabled: app_config_1.config.imoc.syncEnabled,
            linkedTicketCount,
            lastSuccessfulSyncAt: latestLink?.last_synced_at?.toISOString() ?? null,
            connectionMessage: !this.client.enabled
                ? 'IMOC is disabled. Existing IAMS workflows are unaffected.'
                : this.client.configured
                    ? 'IMOC is configured for read-only ticket access.'
                    : 'IMOC is enabled but awaits complete machine-user credentials or a valid break-glass token.',
        };
    }
    async searchTickets(query, actor) {
        assertPermission(actor, 'imoc:read');
        return this.client.listTickets(query);
    }
    async getTicket(lookup, actor) {
        assertPermission(actor, 'imoc:read');
        return this.client.getTicket(lookup);
    }
    async getModel(modelId, actor) {
        assertPermission(actor, 'imoc:read');
        return this.client.getModel(modelId);
    }
    async listLinks(engagementId, actor) {
        assertPermission(actor, 'imoc:read');
        const links = await prisma_client_1.prisma.imoc_Ticket_Link.findMany({
            where: { engagement_id: engagementId, deleted_at: null, is_active: true },
            orderBy: [{ last_synced_at: 'desc' }, { created_at: 'desc' }],
        });
        return links.map(imoc_response_dto_1.mapImocTicketLinkToResponse);
    }
    async getLink(id) {
        const link = await this._getActiveLink(id);
        return (0, imoc_response_dto_1.mapImocTicketLinkToResponse)(link);
    }
    async linkTicket(engagementId, lookup, actor) {
        assertPermission(actor, 'imoc:link');
        const ticket = await this.client.getTicket(lookup);
        const link = await prisma_client_1.prisma.imoc_Ticket_Link.upsert({
            where: {
                engagement_id_order_id: {
                    engagement_id: engagementId,
                    order_id: ticket.orderId,
                },
            },
            create: {
                engagement_id: engagementId,
                created_by_id: actor.id,
                is_active: true,
                ...(0, imoc_response_dto_1.ticketLinkFields)(ticket),
            },
            update: {
                is_active: true,
                deleted_at: null,
                ...(0, imoc_response_dto_1.ticketLinkFields)(ticket),
            },
        });
        logger_util_1.logger.info('IMOC ticket linked to audit engagement', {
            ticketLinkId: link.id,
            engagementId,
            orderNumber: ticket.orderNumber,
            actorId: actor.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'integration.imoc.ticket.link',
            module: 'integration',
            entityType: 'imoc_ticket_link',
            entityId: link.id,
            newValues: { engagementId, orderNumber: ticket.orderNumber, orderId: ticket.orderId },
        });
        return (0, imoc_response_dto_1.mapImocTicketLinkToResponse)(link);
    }
    async unlinkTicket(id, actor) {
        assertPermission(actor, 'imoc:link');
        const link = await this._getActiveLink(id);
        await prisma_client_1.prisma.imoc_Ticket_Link.update({
            where: { id },
            data: { is_active: false, deleted_at: new Date() },
        });
        logger_util_1.logger.info('IMOC ticket unlinked from audit engagement', {
            ticketLinkId: id,
            engagementId: link.engagement_id,
            actorId: actor.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'integration.imoc.ticket.unlink',
            module: 'integration',
            entityType: 'imoc_ticket_link',
            entityId: id,
            oldValues: { engagementId: link.engagement_id, orderNumber: link.order_number },
        });
    }
    async refreshLink(id, actor) {
        assertPermission(actor, 'imoc:sync');
        const link = await this._getActiveLink(id);
        return this._refreshLink(link, actor.id);
    }
    async captureSnapshot(id, actor) {
        assertPermission(actor, 'imoc:capture');
        if (!this.evidenceService) {
            throw app_error_1.AppError.internal('IMOC evidence capture service is not configured.');
        }
        const link = await this._getActiveLink(id);
        const ticket = await this.client.getTicket({ orderId: link.order_id });
        const snapshot = (0, imoc_utility_1.buildSafeImocSnapshot)(ticket);
        const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
        const safeNumber = ticket.orderNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
        const evidence = await this.evidenceService.uploadEvidence(link.engagement_id, {
            originalName: `imoc-ticket-${safeNumber}-snapshot-${ticket.retrievedAt.slice(0, 10)}.json`,
            mimeType: 'application/json',
            fileSize: Buffer.byteLength(serialized),
            buffer: Buffer.from(serialized, 'utf8'),
        }, actor);
        const created = await prisma_client_1.prisma.imoc_Ticket_Snapshot.create({
            data: {
                imoc_ticket_link_id: link.id,
                audit_evidence_id: evidence.id,
                status: ticket.orderStatus,
                sla_status: ticket.slaStatus,
                snapshot_json: serialized,
                payload_sha256: (0, imoc_utility_1.hashSnapshot)(snapshot),
                source_retrieved_at: new Date(ticket.retrievedAt),
                captured_by_id: actor.id,
            },
        });
        await this._updateLinkFromTicket(link.id, ticket);
        logger_util_1.logger.info('IMOC ticket snapshot captured as audit evidence', {
            ticketLinkId: link.id,
            snapshotId: created.id,
            evidenceId: evidence.id,
            actorId: actor.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'integration.imoc.ticket.capture_snapshot',
            module: 'integration',
            entityType: 'imoc_ticket_snapshot',
            entityId: created.id,
            newValues: { ticketLinkId: link.id, evidenceId: evidence.id, payloadSha256: created.payload_sha256 },
        });
        return (0, imoc_response_dto_1.mapImocSnapshotToResponse)(created);
    }
    async listSnapshots(id, actor) {
        assertPermission(actor, 'imoc:read');
        await this._getActiveLink(id);
        const snapshots = await prisma_client_1.prisma.imoc_Ticket_Snapshot.findMany({
            where: { imoc_ticket_link_id: id },
            orderBy: { created_at: 'desc' },
        });
        return snapshots.map(imoc_response_dto_1.mapImocSnapshotToResponse);
    }
    async syncActiveLinks(limit) {
        if (!this.client.enabled || !this.client.configured)
            return { refreshed: 0, failed: 0 };
        const links = await prisma_client_1.prisma.imoc_Ticket_Link.findMany({
            where: { deleted_at: null, is_active: true },
            orderBy: [{ last_synced_at: 'asc' }, { created_at: 'asc' }],
            take: Math.min(Math.max(limit, 1), 100),
        });
        let refreshed = 0;
        let failed = 0;
        for (const link of links) {
            try {
                await this._refreshLink(link, 'system');
                refreshed += 1;
            }
            catch (err) {
                failed += 1;
                await prisma_client_1.prisma.imoc_Ticket_Link.update({
                    where: { id: link.id },
                    data: { last_sync_error: err instanceof Error ? err.message.slice(0, 1000) : 'IMOC refresh failed' },
                });
                logger_util_1.logger.warn('IMOC linked-ticket refresh failed', { ticketLinkId: link.id, err });
            }
        }
        return { refreshed, failed };
    }
    async _refreshLink(link, actorId) {
        try {
            const ticket = await this.client.getTicket({ orderId: link.order_id });
            const updated = await this._updateLinkFromTicket(link.id, ticket);
            audit_log_service_1.auditLogService.logAsync({
                userId: actorId === 'system' ? undefined : actorId,
                action: 'integration.imoc.ticket.refresh',
                module: 'integration',
                entityType: 'imoc_ticket_link',
                entityId: link.id,
                newValues: { orderNumber: ticket.orderNumber, status: ticket.orderStatus, slaStatus: ticket.slaStatus },
            });
            return (0, imoc_response_dto_1.mapImocTicketLinkToResponse)(updated);
        }
        catch (err) {
            await prisma_client_1.prisma.imoc_Ticket_Link.update({
                where: { id: link.id },
                data: { last_sync_error: err instanceof Error ? err.message.slice(0, 1000) : 'IMOC refresh failed' },
            });
            throw err;
        }
    }
    _updateLinkFromTicket(id, ticket) {
        return prisma_client_1.prisma.imoc_Ticket_Link.update({
            where: { id },
            data: (0, imoc_response_dto_1.ticketLinkFields)(ticket),
        });
    }
    async _getActiveLink(id) {
        const link = await prisma_client_1.prisma.imoc_Ticket_Link.findFirst({
            where: { id, deleted_at: null, is_active: true },
        });
        if (!link)
            throw app_error_1.AppError.notFound('IMOC ticket link');
        return link;
    }
}
exports.ImocTicketService = ImocTicketService;
// Scheduler-only singleton. HTTP requests receive their own instance with the
// evidence-service dependency, while the job needs only status refresh.
exports.imocTicketService = new ImocTicketService((0, imoc_client_1.createImocClient)());
//# sourceMappingURL=imoc-ticket.service.js.map