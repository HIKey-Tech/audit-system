import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import {
  buildTabularExport,
  EXPORT_MAX_ROWS,
  ExportColumn,
  TabularExportFile,
} from '../../../../../shared/utils/tabular-export.util';
import {
  IRegisterService,
} from '../../../../risk/register/service/interface/register.service.interface';
import { RiskRegisterService } from '../../../../risk/register/service/implementation/register.service';
import { RiskStatus } from '../../../../risk/domain/enum/risk.enum';
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
  mapImocRiskLinkToResponse,
  mapImocSavedViewToResponse,
  mapImocStoredTicketToResponse,
} from '../../dto/response/imoc.response.dto';
import {
  IImocStoreService,
  StoredTicketDetailResponseDto,
} from '../interface/imoc-store.service.interface';

export class ImocStoreService implements IImocStoreService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly riskService: IRegisterService = new RiskRegisterService(),
  ) {}

  private _buildWhere(query: Partial<ListStoredTicketsQueryDto>): any {
    const where: any = {
      deleted_at: null,
    };

    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      if (statuses.length > 0) {
        where.order_status = { in: statuses };
      }
    }

    if (query.slaStatus) {
      const sla = Array.isArray(query.slaStatus) ? query.slaStatus : [query.slaStatus];
      if (sla.length > 0) {
        where.sla_status = { in: sla };
      }
    }

    if (query.category) {
      const cats = Array.isArray(query.category) ? query.category : [query.category];
      if (cats.length > 0) {
        where.category = { in: cats };
      }
    }

    if (query.modelId && query.modelId.trim()) {
      where.model_id = query.modelId.trim();
    }

    if (query.handler && query.handler.trim()) {
      where.current_handler = { contains: query.handler.trim() };
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { order_number: { contains: s } },
        { order_name: { contains: s } },
      ];
    }

    if (query.createdFrom || query.createdTo) {
      where.imoc_created_at = {};
      if (query.createdFrom) {
        where.imoc_created_at.gte = new Date(query.createdFrom);
      }
      if (query.createdTo) {
        where.imoc_created_at.lte = new Date(query.createdTo);
      }
    }

    return where;
  }

  async listStoredTickets(
    query: ListStoredTicketsQueryDto,
  ): Promise<{
    items: ImocStoredTicketResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const where = this._buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const sortField =
      query.sort === 'orderNumber'
        ? 'order_number'
        : query.sort === 'orderStatus'
        ? 'order_status'
        : query.sort === 'slaStatus'
        ? 'sla_status'
        : query.sort === 'category'
        ? 'category'
        : query.sort === 'lastSyncedAt'
        ? 'last_synced_at'
        : 'imoc_created_at';

    const [tickets, total, rules] = await Promise.all([
      this.prisma.imoc_Ticket.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { [sortField]: query.order },
        include: {
          _count: {
            select: {
              ticket_links: true,
              risk_links: true,
            },
          },
        },
      }),
      this.prisma.imoc_Ticket.count({ where }),
      this.prisma.imoc_Ingestion_Rule.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const ruleNameMap = new Map<string, string>(rules.map((r) => [r.id, r.name]));

    return {
      items: tickets.map((t) => mapImocStoredTicketToResponse(t, ruleNameMap)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }

  async getStoredSummary(
    query: Partial<ListStoredTicketsQueryDto>,
  ): Promise<ImocStoredSummary> {
    const where = this._buildWhere(query);

    const [
      total,
      slaBreachedCount,
      openCount,
      categoryGroups,
      statusGroups,
      slaGroups,
      recentDates,
      modelGroups,
    ] = await this.prisma.$transaction([
      this.prisma.imoc_Ticket.count({ where }),
      this.prisma.imoc_Ticket.count({
        where: {
          ...where,
          sla_status: { in: ['BREAK', 'break', 'BREACH', 'breach'] },
        },
      }),
      this.prisma.imoc_Ticket.count({
        where: {
          ...where,
          order_status: { in: ['processing', 'draft', 'reback', 'suspend'] },
        },
      }),
      this.prisma.imoc_Ticket.groupBy({
        by: ['category'],
        where,
        _count: { _all: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.imoc_Ticket.groupBy({
        by: ['order_status'],
        where,
        _count: { _all: true },
        orderBy: { order_status: 'asc' },
      }),
      this.prisma.imoc_Ticket.groupBy({
        by: ['sla_status'],
        where,
        _count: { _all: true },
        orderBy: { sla_status: 'asc' },
      }),
      this.prisma.imoc_Ticket.findMany({
        where: { ...where, imoc_created_at: { not: null } },
        select: { imoc_created_at: true },
        take: 5000,
      }),
      this.prisma.imoc_Ticket.groupBy({
        by: ['model_id', 'model_name'],
        where,
        _count: { _all: true },
        orderBy: { _count: { model_id: 'desc' } },
        take: 10,
      }),
    ]);

    const byCategory: Record<string, number> = {};
    for (const g of categoryGroups as any[]) {
      byCategory[g.category || 'Uncategorised'] = g._count?._all ?? 0;
    }

    const byStatus: Record<string, number> = {};
    for (const g of statusGroups as any[]) {
      byStatus[g.order_status || 'Unknown'] = g._count?._all ?? 0;
    }

    const bySlaStatus: Record<string, number> = {};
    for (const g of slaGroups as any[]) {
      bySlaStatus[g.sla_status || 'None'] = g._count?._all ?? 0;
    }

    const monthMap: Record<string, number> = {};
    for (const d of recentDates) {
      if (d.imoc_created_at) {
        const monthKey = d.imoc_created_at.toISOString().slice(0, 7);
        monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
      }
    }
    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    const topModels = (modelGroups as any[]).map((m) => ({
      modelId: m.model_id || 'unknown',
      modelName: m.model_name || 'Unknown Model',
      count: m._count?._all ?? 0,
    }));

    return {
      total,
      slaBreachedCount,
      openCount,
      byCategory,
      byStatus,
      bySlaStatus,
      byMonth,
      topModels,
    };
  }

  async getStoredTicket(id: string): Promise<StoredTicketDetailResponseDto> {
    const ticket = await this.prisma.imoc_Ticket.findUnique({
      where: { id },
      include: {
        ticket_links: {
          where: { is_active: true },
          include: {
            engagement: true,
            snapshots: true,
          },
        },
        risk_links: {
          include: {
            risk: true,
          },
        },
      },
    });

    if (!ticket) throw AppError.notFound('Stored IMOC ticket');

    const rules = await this.prisma.imoc_Ingestion_Rule.findMany({
      select: { id: true, name: true },
    });
    const ruleNameMap = new Map<string, string>(rules.map((r) => [r.id, r.name]));
    const base = mapImocStoredTicketToResponse(ticket, ruleNameMap);

    const linkedEngagements = ticket.ticket_links.map((link) => ({
      linkId: link.id,
      engagementId: link.engagement_id,
      engagementTitle: link.engagement.title,
      engagementCode: link.engagement.reference_number,
      isActive: link.is_active,
      linkedAt: link.created_at.toISOString(),
    }));

    const snapshots = ticket.ticket_links.flatMap((link) =>
      link.snapshots.map((s) => ({
        id: s.id,
        status: s.status,
        slaStatus: s.sla_status,
        payloadSha256: s.payload_sha256,
        capturedAt: s.created_at.toISOString(),
        capturedById: s.captured_by_id,
      })),
    );

    const linkedRisks = ticket.risk_links.map((link) => ({
      id: link.id,
      riskId: link.risk.id,
      title: link.risk.title,
      status: link.risk.status,
      currentScore: link.risk.current_score,
      notes: link.notes,
      linkedAt: link.created_at.toISOString(),
    }));

    return {
      ...base,
      linkedEngagements,
      snapshots,
      linkedRisks,
    };
  }

  async exportStoredTickets(
    query: ListStoredTicketsQueryDto,
    format: 'csv' | 'xlsx' = 'xlsx',
  ): Promise<TabularExportFile> {
    const where = this._buildWhere(query);
    const [tickets, rules] = await Promise.all([
      this.prisma.imoc_Ticket.findMany({
        where,
        take: EXPORT_MAX_ROWS,
        orderBy: { imoc_created_at: 'desc' },
      }),
      this.prisma.imoc_Ingestion_Rule.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const ruleNameMap = new Map<string, string>(rules.map((r) => [r.id, r.name]));

    const columns: ExportColumn<any>[] = [
      { header: 'Ticket Number', value: (row) => row.order_number },
      { header: 'Title / Order Name', value: (row) => row.order_name || '' },
      { header: 'Category', value: (row) => row.category || 'Uncategorised' },
      { header: 'Status', value: (row) => row.order_status || '' },
      { header: 'SLA Status', value: (row) => row.sla_status || '' },
      { header: 'Priority', value: (row) => row.priority || '' },
      { header: 'Model Name', value: (row) => row.model_name || '' },
      { header: 'Current Handler', value: (row) => row.current_handler || '' },
      { header: 'Applicant', value: (row) => row.created_by_name || '' },
      { header: 'Created In IMOC', value: (row) => row.imoc_created_at ? new Date(row.imoc_created_at).toISOString() : '' },
      { header: 'Ended In IMOC', value: (row) => row.imoc_ended_at ? new Date(row.imoc_ended_at).toISOString() : '' },
      {
        header: 'Matched Rules',
        value: (row) => {
          try {
            const ids = JSON.parse(row.matched_rule_ids || '[]');
            return ids.map((id: string) => ruleNameMap.get(id) || id).join(', ');
          } catch {
            return '';
          }
        },
      },
      { header: 'Last Synced At', value: (row) => new Date(row.last_synced_at).toISOString() },
    ];

    return buildTabularExport(tickets, columns, {
      baseName: 'imoc-tickets',
      format,
      sheetName: 'IMOC Ingested Tickets',
    });
  }

  async listSavedViews(ownerId: string): Promise<ImocSavedViewResponseDto[]> {
    const views = await this.prisma.imoc_Saved_View.findMany({
      where: { owner_id: ownerId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    });
    return views.map(mapImocSavedViewToResponse);
  }

  async createSavedView(
    ownerId: string,
    data: CreateSavedViewDto,
  ): Promise<ImocSavedViewResponseDto> {
    const existing = await this.prisma.imoc_Saved_View.findFirst({
      where: { owner_id: ownerId, name: data.name, deleted_at: null },
    });
    if (existing) {
      throw AppError.conflict('A saved view with this name already exists.');
    }

    if (data.isDefault) {
      await this.prisma.imoc_Saved_View.updateMany({
        where: { owner_id: ownerId },
        data: { is_default: false },
      });
    }

    const view = await this.prisma.imoc_Saved_View.create({
      data: {
        name: data.name,
        filters_json: JSON.stringify(data.filters),
        owner_id: ownerId,
        is_default: data.isDefault ?? false,
      },
    });

    auditLogService.logAsync({
      userId: ownerId,
      action: 'integration.imoc.view.create',
      module: 'integration',
      entityType: 'imoc_saved_view',
      entityId: view.id,
      newValues: { name: view.name },
    });

    return mapImocSavedViewToResponse(view);
  }

  async updateSavedView(
    ownerId: string,
    id: string,
    data: UpdateSavedViewDto,
  ): Promise<ImocSavedViewResponseDto> {
    const view = await this.prisma.imoc_Saved_View.findFirst({
      where: { id, owner_id: ownerId, deleted_at: null },
    });
    if (!view) throw AppError.notFound('Saved view');

    if (data.name && data.name !== view.name) {
      const existing = await this.prisma.imoc_Saved_View.findFirst({
        where: { owner_id: ownerId, name: data.name, deleted_at: null },
      });
      if (existing) throw AppError.conflict('A saved view with this name already exists.');
    }

    if (data.isDefault) {
      await this.prisma.imoc_Saved_View.updateMany({
        where: { owner_id: ownerId },
        data: { is_default: false },
      });
    }

    const updated = await this.prisma.imoc_Saved_View.update({
      where: { id },
      data: {
        name: data.name ?? view.name,
        filters_json: data.filters ? JSON.stringify(data.filters) : view.filters_json,
        is_default: data.isDefault !== undefined ? data.isDefault : view.is_default,
      },
    });

    auditLogService.logAsync({
      userId: ownerId,
      action: 'integration.imoc.view.update',
      module: 'integration',
      entityType: 'imoc_saved_view',
      entityId: id,
      newValues: { name: updated.name },
    });

    return mapImocSavedViewToResponse(updated);
  }

  async deleteSavedView(ownerId: string, id: string): Promise<void> {
    const view = await this.prisma.imoc_Saved_View.findFirst({
      where: { id, owner_id: ownerId, deleted_at: null },
    });
    if (!view) throw AppError.notFound('Saved view');

    await this.prisma.imoc_Saved_View.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    auditLogService.logAsync({
      userId: ownerId,
      action: 'integration.imoc.view.delete',
      module: 'integration',
      entityType: 'imoc_saved_view',
      entityId: id,
    });
  }

  async linkTicketToRisk(
    actor: any,
    data: CreateTicketRiskLinkDto,
  ): Promise<ImocTicketRiskLinkResponseDto> {
    const ticket = await this.prisma.imoc_Ticket.findUnique({
      where: { id: data.imocTicketId },
    });
    if (!ticket) throw AppError.notFound('Stored IMOC ticket');

    let targetRiskId = data.riskId;

    if (data.createRisk) {
      const createdRisk = await this.riskService.createRisk(
        {
          title: data.createRisk.title,
          description: data.createRisk.description,
          categoryId: data.createRisk.categoryId,
          ownerId: actor.id,
          likelihood: data.createRisk.likelihood,
          impact: data.createRisk.impact,
          status: RiskStatus.Open,
          businessObjective: data.createRisk.businessObjective,
        },
        actor,
      );
      targetRiskId = createdRisk.id;
    }

    if (!targetRiskId) {
      throw AppError.badRequest('Provide either an existing riskId or createRisk details.');
    }

    const existingLink = await this.prisma.imoc_Ticket_Risk_Link.findUnique({
      where: {
        imoc_ticket_id_risk_id: {
          imoc_ticket_id: data.imocTicketId,
          risk_id: targetRiskId,
        },
      },
    });

    if (existingLink) {
      throw AppError.conflict('This IMOC ticket is already linked to the specified risk.');
    }

    const link = await this.prisma.imoc_Ticket_Risk_Link.create({
      data: {
        imoc_ticket_id: data.imocTicketId,
        risk_id: targetRiskId,
        notes: data.notes ?? null,
        created_by_id: actor.id,
      },
      include: {
        risk: true,
      },
    });

    logger.info('IMOC ticket linked to risk', {
      ticketId: ticket.id,
      riskId: targetRiskId,
      actorId: actor.id,
    });

    auditLogService.logAsync({
      userId: actor.id,
      action: 'integration.imoc.ticket.risk_link',
      module: 'integration',
      entityType: 'imoc_ticket_risk_link',
      entityId: link.id,
      newValues: {
        imocTicketId: ticket.id,
        orderNumber: ticket.order_number,
        riskId: targetRiskId,
      },
    });

    return mapImocRiskLinkToResponse(link);
  }

  async unlinkTicketRisk(
    actorId: string,
    ticketId: string,
    riskId: string,
  ): Promise<void> {
    const link = await this.prisma.imoc_Ticket_Risk_Link.findUnique({
      where: {
        imoc_ticket_id_risk_id: {
          imoc_ticket_id: ticketId,
          risk_id: riskId,
        },
      },
    });

    if (!link) throw AppError.notFound('IMOC ticket risk link');

    await this.prisma.imoc_Ticket_Risk_Link.delete({
      where: { id: link.id },
    });

    logger.info('IMOC ticket unlinked from risk', { ticketId, riskId, actorId });

    auditLogService.logAsync({
      userId: actorId,
      action: 'integration.imoc.ticket.risk_unlink',
      module: 'integration',
      entityType: 'imoc_ticket_risk_link',
      entityId: link.id,
      oldValues: { imocTicketId: ticketId, riskId },
    });
  }
}

export const imocStoreService = new ImocStoreService();
