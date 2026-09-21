import { Imoc_Ticket_Link } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IEvidenceService } from '../../../../audit/evidence/service/interface/evidence.service.interface';
import { ActorContext } from '../../../../audit/domain/entity/audit.entity';
import { config } from '../../../../../shared/config/app.config';
import {
  ImocIntegrationStatus,
  ImocModelSummary,
  ImocTicket,
  ImocTicketLookup,
  ImocTicketPage,
  ImocTicketSearch,
} from '../../domain/entity/imoc.entity';
import {
  ImocTicketLinkResponseDto,
  ImocTicketSnapshotResponseDto,
  mapImocSnapshotToResponse,
  mapImocTicketLinkToResponse,
  ticketLinkFields,
} from '../../dto/response/imoc.response.dto';
import { IImocClient, createImocClient } from '../client/imoc.client';
import { IImocTicketService } from '../interface/imoc-ticket.service.interface';
import { buildSafeImocSnapshot, hashSnapshot } from '../../utility/imoc.utility';

const assertPermission = (actor: ActorContext, permission: string): void => {
  if (!actor.permissions.includes(permission)) {
    throw AppError.forbidden(`Missing required permission: ${permission}`);
  }
};

export class ImocTicketService implements IImocTicketService {
  constructor(
    private readonly client: IImocClient,
    private readonly evidenceService?: IEvidenceService,
  ) {}

  async getStatus(): Promise<ImocIntegrationStatus> {
    const [linkedTicketCount, latestLink] = await prisma.$transaction([
      prisma.imoc_Ticket_Link.count({ where: { deleted_at: null, is_active: true } }),
      prisma.imoc_Ticket_Link.findFirst({
        where: { deleted_at: null, last_synced_at: { not: null } },
        orderBy: { last_synced_at: 'desc' },
        select: { last_synced_at: true },
      }),
    ]);

    return {
      enabled: this.client.enabled,
      configured: this.client.configured,
      syncEnabled: config.imoc.syncEnabled,
      linkedTicketCount,
      lastSuccessfulSyncAt: latestLink?.last_synced_at?.toISOString() ?? null,
      connectionMessage: !this.client.enabled
        ? 'IMOC is disabled. Existing IAMS workflows are unaffected.'
        : this.client.configured
          ? 'IMOC is configured for read-only ticket access.'
          : 'IMOC is enabled but awaits complete machine-user credentials or a valid break-glass token.',
    };
  }

  async searchTickets(query: ImocTicketSearch, actor: ActorContext): Promise<ImocTicketPage> {
    assertPermission(actor, 'imoc:read');
    return this.client.listTickets(query);
  }

  async getTicket(lookup: ImocTicketLookup, actor: ActorContext): Promise<ImocTicket> {
    assertPermission(actor, 'imoc:read');
    return this.client.getTicket(lookup);
  }

  async getModel(modelId: string, actor: ActorContext): Promise<ImocModelSummary> {
    assertPermission(actor, 'imoc:read');
    return this.client.getModel(modelId);
  }

  async listLinks(engagementId: string, actor: ActorContext): Promise<ImocTicketLinkResponseDto[]> {
    assertPermission(actor, 'imoc:read');
    const links = await prisma.imoc_Ticket_Link.findMany({
      where: { engagement_id: engagementId, deleted_at: null, is_active: true },
      orderBy: [{ last_synced_at: 'desc' }, { created_at: 'desc' }],
    });
    return links.map(mapImocTicketLinkToResponse);
  }

  async getLink(id: string): Promise<ImocTicketLinkResponseDto> {
    const link = await this._getActiveLink(id);
    return mapImocTicketLinkToResponse(link);
  }

  async linkTicket(
    engagementId: string,
    lookup: ImocTicketLookup,
    actor: ActorContext,
  ): Promise<ImocTicketLinkResponseDto> {
    assertPermission(actor, 'imoc:link');
    const ticket = await this.client.getTicket(lookup);
    const link = await prisma.imoc_Ticket_Link.upsert({
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
        ...ticketLinkFields(ticket),
      },
      update: {
        is_active: true,
        deleted_at: null,
        ...ticketLinkFields(ticket),
      },
    });
    logger.info('IMOC ticket linked to audit engagement', {
      ticketLinkId: link.id,
      engagementId,
      orderNumber: ticket.orderNumber,
      actorId: actor.id,
    });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'integration.imoc.ticket.link',
      module: 'integration',
      entityType: 'imoc_ticket_link',
      entityId: link.id,
      newValues: { engagementId, orderNumber: ticket.orderNumber, orderId: ticket.orderId },
    });
    return mapImocTicketLinkToResponse(link);
  }

  async unlinkTicket(id: string, actor: ActorContext): Promise<void> {
    assertPermission(actor, 'imoc:link');
    const link = await this._getActiveLink(id);
    await prisma.imoc_Ticket_Link.update({
      where: { id },
      data: { is_active: false, deleted_at: new Date() },
    });
    logger.info('IMOC ticket unlinked from audit engagement', {
      ticketLinkId: id,
      engagementId: link.engagement_id,
      actorId: actor.id,
    });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'integration.imoc.ticket.unlink',
      module: 'integration',
      entityType: 'imoc_ticket_link',
      entityId: id,
      oldValues: { engagementId: link.engagement_id, orderNumber: link.order_number },
    });
  }

  async refreshLink(id: string, actor: ActorContext): Promise<ImocTicketLinkResponseDto> {
    assertPermission(actor, 'imoc:sync');
    const link = await this._getActiveLink(id);
    return this._refreshLink(link, actor.id);
  }

  async captureSnapshot(id: string, actor: ActorContext): Promise<ImocTicketSnapshotResponseDto> {
    assertPermission(actor, 'imoc:capture');
    if (!this.evidenceService) {
      throw AppError.internal('IMOC evidence capture service is not configured.');
    }
    const link = await this._getActiveLink(id);
    const ticket = await this.client.getTicket({ orderId: link.order_id });
    const snapshot = buildSafeImocSnapshot(ticket);
    const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
    const safeNumber = ticket.orderNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
    const evidence = await this.evidenceService.uploadEvidence(
      link.engagement_id,
      {
        originalName: `imoc-ticket-${safeNumber}-snapshot-${ticket.retrievedAt.slice(0, 10)}.json`,
        mimeType: 'application/json',
        fileSize: Buffer.byteLength(serialized),
        buffer: Buffer.from(serialized, 'utf8'),
      },
      actor,
    );

    const created = await prisma.imoc_Ticket_Snapshot.create({
      data: {
        imoc_ticket_link_id: link.id,
        audit_evidence_id: evidence.id,
        status: ticket.orderStatus,
        sla_status: ticket.slaStatus,
        snapshot_json: serialized,
        payload_sha256: hashSnapshot(snapshot),
        source_retrieved_at: new Date(ticket.retrievedAt),
        captured_by_id: actor.id,
      },
    });
    await this._updateLinkFromTicket(link.id, ticket);
    logger.info('IMOC ticket snapshot captured as audit evidence', {
      ticketLinkId: link.id,
      snapshotId: created.id,
      evidenceId: evidence.id,
      actorId: actor.id,
    });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'integration.imoc.ticket.capture_snapshot',
      module: 'integration',
      entityType: 'imoc_ticket_snapshot',
      entityId: created.id,
      newValues: { ticketLinkId: link.id, evidenceId: evidence.id, payloadSha256: created.payload_sha256 },
    });
    return mapImocSnapshotToResponse(created);
  }

  async listSnapshots(id: string, actor: ActorContext): Promise<ImocTicketSnapshotResponseDto[]> {
    assertPermission(actor, 'imoc:read');
    await this._getActiveLink(id);
    const snapshots = await prisma.imoc_Ticket_Snapshot.findMany({
      where: { imoc_ticket_link_id: id },
      orderBy: { created_at: 'desc' },
    });
    return snapshots.map(mapImocSnapshotToResponse);
  }

  async syncActiveLinks(limit: number): Promise<{ refreshed: number; failed: number }> {
    if (!this.client.enabled || !this.client.configured) return { refreshed: 0, failed: 0 };
    const links = await prisma.imoc_Ticket_Link.findMany({
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
      } catch (err) {
        failed += 1;
        await prisma.imoc_Ticket_Link.update({
          where: { id: link.id },
          data: { last_sync_error: err instanceof Error ? err.message.slice(0, 1000) : 'IMOC refresh failed' },
        });
        logger.warn('IMOC linked-ticket refresh failed', { ticketLinkId: link.id, err });
      }
    }
    return { refreshed, failed };
  }

  private async _refreshLink(link: Imoc_Ticket_Link, actorId: string): Promise<ImocTicketLinkResponseDto> {
    try {
      const ticket = await this.client.getTicket({ orderId: link.order_id });
      const updated = await this._updateLinkFromTicket(link.id, ticket);
      auditLogService.logAsync({
        userId: actorId === 'system' ? undefined : actorId,
        action: 'integration.imoc.ticket.refresh',
        module: 'integration',
        entityType: 'imoc_ticket_link',
        entityId: link.id,
        newValues: { orderNumber: ticket.orderNumber, status: ticket.orderStatus, slaStatus: ticket.slaStatus },
      });
      return mapImocTicketLinkToResponse(updated);
    } catch (err) {
      await prisma.imoc_Ticket_Link.update({
        where: { id: link.id },
        data: { last_sync_error: err instanceof Error ? err.message.slice(0, 1000) : 'IMOC refresh failed' },
      });
      throw err;
    }
  }

  private _updateLinkFromTicket(id: string, ticket: ImocTicket): Promise<Imoc_Ticket_Link> {
    return prisma.imoc_Ticket_Link.update({
      where: { id },
      data: ticketLinkFields(ticket),
    });
  }

  private async _getActiveLink(id: string): Promise<Imoc_Ticket_Link> {
    const link = await prisma.imoc_Ticket_Link.findFirst({
      where: { id, deleted_at: null, is_active: true },
    });
    if (!link) throw AppError.notFound('IMOC ticket link');
    return link;
  }
}

// Scheduler-only singleton. HTTP requests receive their own instance with the
// evidence-service dependency, while the job needs only status refresh.
export const imocTicketService = new ImocTicketService(createImocClient());
