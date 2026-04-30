import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext, ChecklistProgress, FindingSeverityCount } from '../../../domain/entity/audit.entity';
import { EngagementStatus, FindingStatus, PlanStatus } from '../../../domain/enum/audit.enum';
import {
  AUDIT_ADMIN_ROLES,
  ENGAGEMENT_TRANSITIONS,
  assertHasRole,
  assertTransition,
  buildReferenceNumber,
  hasAuditeeRole,
  parseReferenceSequence,
} from '../../../utility/audit.utility';
import { IChecklistService } from '../../../checklists/service/interface/checklist.service.interface';
import {
  CreateAdhocEngagementRequestDto,
  CreateEngagementFromPlanRequestDto,
  EngagementQueryDto,
  UpdateEngagementRequestDto,
} from '../../dto/request/engagement.request.dto';
import { EngagementResponseDto, mapEngagementToResponse } from '../../dto/response/engagement.response.dto';
import { IEngagementService } from '../interface/engagement.service.interface';

const engagementInclude = { universe: true };

export class EngagementService implements IEngagementService {
  constructor(private readonly checklistService: IChecklistService) {}

  async createFromPlanItem(
    planItemId: string,
    dto: CreateEngagementFromPlanRequestDto,
    actor: ActorContext,
  ): Promise<EngagementResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);

    const planItem = await prisma.audit_Plan_Item.findUnique({
      where: { id: planItemId },
      include: { plan: true },
    });
    if (!planItem) throw AppError.notFound('Audit plan item');
    if (planItem.plan.status !== PlanStatus.Approved) throw AppError.badRequest('Plan must be approved before creating an engagement');
    if (planItem.engagement_created) throw AppError.conflict('An engagement has already been created from this plan item');

    const referenceNumber = await this._nextReferenceNumber(new Date(dto.plannedStartDate).getUTCFullYear());
    const engagement = await prisma.$transaction(async (tx) => {
      const created = await tx.audit_Engagement.create({
        data: {
          reference_number: referenceNumber,
          title: dto.title,
          universe_id: planItem.universe_id,
          plan_item_id: planItemId,
          audit_type: planItem.audit_type,
          priority: planItem.priority,
          lead_auditor_id: dto.leadAuditorId,
          audit_manager_id: dto.auditManagerId,
          auditee_id: dto.auditeeId,
          planned_start_date: new Date(dto.plannedStartDate),
          planned_end_date: new Date(dto.plannedEndDate),
          sla_deadline: new Date(dto.slaDeadline),
          created_by_id: actor.id,
        },
        include: engagementInclude,
      });

      await tx.audit_Plan_Item.update({
        where: { id: planItemId },
        data: { engagement_created: true },
      });

      return created;
    });

    logger.info('Audit engagement created from plan item', { engagementId: engagement.id, planItemId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.create_from_plan', module: 'audit', entityType: 'audit_engagement', entityId: engagement.id });
    return mapEngagementToResponse(engagement);
  }

  async createAdhoc(dto: CreateAdhocEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    if (!dto.adhocReason) throw AppError.badRequest('Ad-hoc reason is required');

    const referenceNumber = await this._nextReferenceNumber(new Date(dto.plannedStartDate).getUTCFullYear());
    const engagement = await prisma.audit_Engagement.create({
      data: {
        reference_number: referenceNumber,
        title: dto.title,
        universe_id: dto.universeId,
        audit_type: dto.auditType,
        priority: dto.priority,
        lead_auditor_id: dto.leadAuditorId,
        audit_manager_id: dto.auditManagerId,
        auditee_id: dto.auditeeId,
        planned_start_date: new Date(dto.plannedStartDate),
        planned_end_date: new Date(dto.plannedEndDate),
        sla_deadline: new Date(dto.slaDeadline),
        is_adhoc: true,
        adhoc_reason: dto.adhocReason,
        created_by_id: actor.id,
      },
      include: engagementInclude,
    });

    logger.info('Ad-hoc audit engagement created', { engagementId: engagement.id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.create_adhoc', module: 'audit', entityType: 'audit_engagement', entityId: engagement.id });
    return mapEngagementToResponse(engagement);
  }

  async updateEngagement(id: string, dto: UpdateEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    await this._assertEngagementExists(id);

    const engagement = await prisma.audit_Engagement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.leadAuditorId !== undefined && { lead_auditor_id: dto.leadAuditorId }),
        ...(dto.auditManagerId !== undefined && { audit_manager_id: dto.auditManagerId }),
        ...(dto.auditeeId !== undefined && { auditee_id: dto.auditeeId }),
        ...(dto.plannedStartDate !== undefined && { planned_start_date: new Date(dto.plannedStartDate) }),
        ...(dto.plannedEndDate !== undefined && { planned_end_date: new Date(dto.plannedEndDate) }),
        ...(dto.slaDeadline !== undefined && { sla_deadline: new Date(dto.slaDeadline) }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.adhocReason !== undefined && { adhoc_reason: dto.adhocReason }),
      },
      include: engagementInclude,
    });

    logger.info('Audit engagement updated', { engagementId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.update', module: 'audit', entityType: 'audit_engagement', entityId: id, newValues: mapEngagementToResponse(engagement) });
    return mapEngagementToResponse(engagement);
  }

  async updateStatus(id: string, newStatus: EngagementStatus, actor: ActorContext): Promise<EngagementResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id, deleted_at: null },
      include: engagementInclude,
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    assertTransition(engagement.status as EngagementStatus, newStatus, ENGAGEMENT_TRANSITIONS, 'engagement');

    if (newStatus === EngagementStatus.Closed) {
      const openFindingCount = await prisma.audit_Finding.count({
        where: {
          engagement_id: id,
          deleted_at: null,
          status: { notIn: [FindingStatus.Verified, FindingStatus.Closed] },
        },
      });
      if (openFindingCount > 0) throw AppError.badRequest('Cannot close engagement while findings remain unverified or open');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.audit_Engagement.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === EngagementStatus.InProgress && { actual_start_date: new Date() }),
          ...(newStatus === EngagementStatus.Closed && { actual_end_date: new Date() }),
        },
        include: engagementInclude,
      });

      if (newStatus === EngagementStatus.Closed) {
        await tx.audit_Universe.update({
          where: { id: engagement.universe_id },
          data: { last_audited_at: new Date() },
        });
      }

      return result;
    });

    if (newStatus === EngagementStatus.InProgress) {
      await this.checklistService.populateChecklists(id, actor.id);
    }

    logger.info('Audit engagement status updated', { engagementId: id, status: newStatus, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.status.update', module: 'audit', entityType: 'audit_engagement', entityId: id, newValues: { status: newStatus } });
    return this._withMetrics(updated);
  }

  async getEngagementById(id: string, actor: ActorContext): Promise<EngagementResponseDto> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: {
        id,
        deleted_at: null,
        ...(hasAuditeeRole(actor.roles) && { auditee_id: actor.id }),
      },
      include: engagementInclude,
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    return this._withMetrics(engagement);
  }

  async listEngagements(query: EngagementQueryDto, actor: ActorContext): Promise<{ engagements: EngagementResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const isAdmin = actor.roles.some((role) => AUDIT_ADMIN_ROLES.includes(role));
    const isAuditee = hasAuditeeRole(actor.roles);
    const where: Prisma.Audit_EngagementWhereInput = {
      deleted_at: null,
      ...(query.status && { status: query.status }),
      ...(query.auditType && { audit_type: query.auditType }),
      ...(query.leadAuditorId && { lead_auditor_id: query.leadAuditorId }),
      ...(query.auditManagerId && { audit_manager_id: query.auditManagerId }),
      ...(isAuditee && { auditee_id: actor.id }),
      ...(!isAdmin && !isAuditee && { lead_auditor_id: actor.id }),
    };

    const [total, engagements] = await prisma.$transaction([
      prisma.audit_Engagement.count({ where }),
      prisma.audit_Engagement.findMany({
        where,
        include: engagementInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      engagements: engagements.map((engagement) => mapEngagementToResponse(engagement)),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  private async _nextReferenceNumber(year: number): Promise<string> {
    const latest = await prisma.audit_Engagement.findFirst({
      where: { reference_number: { startsWith: `AUD-${year}-` } },
      orderBy: { reference_number: 'desc' },
      select: { reference_number: true },
    });
    const sequence = latest ? parseReferenceSequence(latest.reference_number, year) + 1 : 1;
    return buildReferenceNumber(year, sequence);
  }

  private async _assertEngagementExists(id: string): Promise<void> {
    const engagement = await prisma.audit_Engagement.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!engagement) throw AppError.notFound('Audit engagement');
  }

  private async _withMetrics(engagement: Parameters<typeof mapEngagementToResponse>[0]): Promise<EngagementResponseDto> {
    const [findingGroups, workingPaperCount, checklistProgress] = await Promise.all([
      prisma.audit_Finding.groupBy({
        by: ['severity'],
        where: { engagement_id: engagement.id, deleted_at: null },
        _count: { _all: true },
      }),
      prisma.audit_Working_Paper.count({ where: { engagement_id: engagement.id, deleted_at: null } }),
      this.checklistService.getChecklistProgress(engagement.id),
    ]);

    const findingCounts: FindingSeverityCount[] = findingGroups.map((group) => ({
      severity: group.severity,
      count: group._count._all,
    }));
    const progress: ChecklistProgress = checklistProgress;

    return mapEngagementToResponse(engagement, {
      findingCounts,
      workingPaperCount,
      checklistProgress: progress,
    });
  }
}
