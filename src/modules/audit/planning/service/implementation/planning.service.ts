import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
import { WorkflowEntityType } from '../../../../workflow/domain/enum/workflow.enum';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { FindingStatus, PlanStatus, UniverseStatus } from '../../../domain/enum/audit.enum';
import { PLAN_EDITABLE_STATUSES, assertHasPermission, auditTypeLabel, decimalToNumber } from '../../../utility/audit.utility';
import { getPlanningPriorityWeights } from '../../../utility/audit-config.utility';
import { mapUniverseToResponse } from '../../../universe/dto/response/universe.response.dto';
import {
  AddPlanItemRequestDto,
  BulkAddPlanItemsRequestDto,
  CreatePlanRequestDto,
  PlanQueryDto,
  UpdatePlanItemRequestDto,
  UpdatePlanRequestDto,
} from '../../dto/request/planning.request.dto';
import { PlanResponseDto, mapPlanToResponse } from '../../dto/response/planning.response.dto';
import {
  classifyUniverseDueStatus,
  computeEntityRecommendation,
  recommendedPriorityFromRiskScore,
} from '../../utility/planning.utility';
import {
  getCachedRecommendations,
  setCachedRecommendations,
} from '../../utility/recommendations-cache.utility';
import {
  IPlanningService,
  PlanUniverseCandidateDto,
  PlanningRecommendationDto,
} from '../interface/planning.service.interface';

const planInclude = {
  approved_by: { select: { display_name: true, first_name: true, last_name: true } },
  items: {
    include: { universe: true, engagements: { select: { id: true }, where: { deleted_at: null } } },
    orderBy: { created_at: 'asc' as const },
  },
};

const candidateOwnerSelect = { id: true, display_name: true, first_name: true, last_name: true } as const;

export class PlanningService implements IPlanningService {
  constructor(private readonly approvalService: IApprovalService = workflowApprovalService) {}

  /**
   * Composite audit-priority ranking over the active audit universe — the
   * defensible "what should we audit next year" list. Each signal is scored
   * 0-100 and blended with admin-configurable weights
   * (system_config.planning_priority_weights), so GBB decides what "priority"
   * means without a redeploy. The per-entity component breakdown and reasons
   * are returned so the ranking is explainable, not a black box.
   */
  async getRecommendations(): Promise<PlanningRecommendationDto[]> {
    const cached = getCachedRecommendations();
    if (cached) return cached;

    const [weights, entities, openFindings] = await Promise.all([
      getPlanningPriorityWeights(),
      prisma.audit_Universe.findMany({
        where: { deleted_at: null, status: UniverseStatus.Active },
        select: {
          id: true,
          name: true,
          category: true,
          risk_score: true,
          audit_frequency: true,
          last_audited_at: true,
        },
      }),
      prisma.audit_Finding.findMany({
        where: {
          deleted_at: null,
          status: { not: FindingStatus.Closed },
          engagement: { deleted_at: null },
        },
        select: { engagement: { select: { universe_id: true } } },
      }),
    ]);

    const openByUniverse = new Map<string, number>();
    for (const finding of openFindings) {
      const key = finding.engagement.universe_id;
      openByUniverse.set(key, (openByUniverse.get(key) ?? 0) + 1);
    }

    const now = new Date();
    const sorted = entities
      .map((entity) =>
        computeEntityRecommendation(
          {
            id: entity.id,
            name: entity.name,
            category: entity.category,
            riskScore: decimalToNumber(entity.risk_score) ?? 0,
            auditFrequency: entity.audit_frequency,
            lastAuditedAt: entity.last_audited_at,
          },
          openByUniverse.get(entity.id) ?? 0,
          weights,
          now,
        ),
      )
      .sort((a, b) => b.score - a.score);

    setCachedRecommendations(sorted);
    return sorted;
  }

  /**
   * Returns all active audit universe entities enriched with due-cycle classification,
   * recommended priority, owners, and existing coverage within the target programme's year.
   */
  async getUniverseCandidates(planId: string): Promise<PlanUniverseCandidateDto[]> {
    const plan = await prisma.audit_Plan.findFirst({
      where: { id: planId, deleted_at: null },
      select: { id: true, year: true },
    });
    if (!plan) throw AppError.notFound('Audit plan');

    const [weights, entities, openFindings, yearPlanItems] = await Promise.all([
      getPlanningPriorityWeights(),
      prisma.audit_Universe.findMany({
        where: { deleted_at: null, status: UniverseStatus.Active },
        include: {
          owner: { select: candidateOwnerSelect },
          additional_owners: {
            include: { user: { select: candidateOwnerSelect } },
            orderBy: { created_at: 'asc' },
          },
        },
      }),
      prisma.audit_Finding.findMany({
        where: {
          deleted_at: null,
          status: { not: FindingStatus.Closed },
          engagement: { deleted_at: null },
        },
        select: { engagement: { select: { universe_id: true } } },
      }),
      prisma.audit_Plan_Item.findMany({
        where: { plan: { year: plan.year, deleted_at: null } },
        select: {
          universe_id: true,
          plan_id: true,
          plan: { select: { id: true, title: true, audit_type: true, status: true } },
        },
      }),
    ]);

    const openByUniverse = new Map<string, number>();
    for (const finding of openFindings) {
      const key = finding.engagement.universe_id;
      openByUniverse.set(key, (openByUniverse.get(key) ?? 0) + 1);
    }

    const thisPlanCountByUniverse = new Map<string, number>();
    const otherPlansByUniverse = new Map<
      string,
      Map<string, { planId: string; planTitle: string; auditType: string; status: string }>
    >();

    for (const item of yearPlanItems) {
      if (item.plan_id === plan.id) {
        thisPlanCountByUniverse.set(
          item.universe_id,
          (thisPlanCountByUniverse.get(item.universe_id) ?? 0) + 1,
        );
      } else {
        let mapForEntity = otherPlansByUniverse.get(item.universe_id);
        if (!mapForEntity) {
          mapForEntity = new Map();
          otherPlansByUniverse.set(item.universe_id, mapForEntity);
        }
        mapForEntity.set(item.plan_id, {
          planId: item.plan.id,
          planTitle: item.plan.title,
          auditType: item.plan.audit_type,
          status: item.plan.status,
        });
      }
    }

    const now = new Date();
    return entities
      .map((entity): PlanUniverseCandidateDto => {
        const mapped = mapUniverseToResponse(entity);
        const riskScore = mapped.riskScore ?? 0;
        const openCount = openByUniverse.get(entity.id) ?? 0;
        const rec = computeEntityRecommendation(
          {
            id: entity.id,
            name: entity.name,
            category: entity.category,
            riskScore,
            auditFrequency: entity.audit_frequency,
            lastAuditedAt: entity.last_audited_at,
          },
          openCount,
          weights,
          now,
        );
        const dueStatus = classifyUniverseDueStatus(
          entity.audit_frequency,
          entity.last_audited_at,
          plan.year,
          now,
        );

        return {
          universeId: entity.id,
          name: entity.name,
          description: entity.description,
          category: entity.category,
          ownerName: mapped.ownerName,
          owners: mapped.owners,
          riskScore,
          auditFrequency: entity.audit_frequency,
          lastAuditedAt: mapped.lastAuditedAt,
          openFindingsCount: openCount,
          score: rec.score,
          reasons: rec.reasons,
          recommendedPriority: recommendedPriorityFromRiskScore(riskScore),
          dueStatus,
          alreadyInThisPlanCount: thisPlanCountByUniverse.get(entity.id) ?? 0,
          alreadyInYearPlans: [...(otherPlansByUniverse.get(entity.id)?.values() ?? [])],
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  async createPlan(dto: CreatePlanRequestDto, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasPermission(actor.permissions, 'plan:create');

    const existingCount = await prisma.audit_Plan.count({
      where: { year: dto.year, audit_type: dto.auditType, deleted_at: null },
    });

    const plan = await prisma.audit_Plan.create({
      data: {
        title: dto.title,
        year: dto.year,
        audit_type: dto.auditType,
        description: dto.description ?? null,
        created_by_id: actor.id,
      },
      include: planInclude,
    });

    logger.info('Audit plan created', { planId: plan.id, year: plan.year, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.plan.create',
      module: 'audit',
      entityType: 'audit_plan',
      entityId: plan.id,
    });

    return mapPlanToResponse(
      plan,
      existingCount > 0
        ? [`A ${auditTypeLabel(dto.auditType)} programme for ${dto.year} already exists`]
        : undefined,
    );
  }

  async updatePlan(planId: string, dto: UpdatePlanRequestDto, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasPermission(actor.permissions, 'plan:update');
    if (dto.title === undefined && dto.year === undefined && dto.description === undefined) {
      throw AppError.badRequest('At least one field is required');
    }
    await this._assertDraftPlan(planId);
    const before = await prisma.audit_Plan.findUnique({
      where: { id: planId },
      select: { title: true, year: true, description: true },
    });

    const updated = await prisma.audit_Plan.update({
      where: { id: planId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: planInclude,
    });

    logger.info('Audit plan updated', { planId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.plan.update',
      module: 'audit',
      entityType: 'audit_plan',
      entityId: planId,
      oldValues: before ?? undefined,
      newValues: dto,
    });

    return mapPlanToResponse(updated);
  }

  async deletePlan(planId: string, actor: ActorContext): Promise<void> {
    assertHasPermission(actor.permissions, 'plan:update');
    await this._assertDraftPlan(planId);

    const engagementCount = await prisma.audit_Engagement.count({
      where: {
        deleted_at: null,
        plan_item: { plan_id: planId },
      },
    });
    if (engagementCount > 0) {
      throw AppError.badRequest('Cannot delete a plan after engagements have been created from it');
    }

    await prisma.$transaction([
      prisma.audit_Plan_Item.deleteMany({ where: { plan_id: planId } }),
      prisma.audit_Plan.update({
        where: { id: planId },
        data: { deleted_at: new Date() },
      }),
    ]);

    logger.info('Audit plan deleted', { planId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.plan.delete',
      module: 'audit',
      entityType: 'audit_plan',
      entityId: planId,
    });
  }

  async addPlanItem(planId: string, dto: AddPlanItemRequestDto, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasPermission(actor.permissions, 'plan:add_item');
    await this._assertDraftPlan(planId);
    await this._assertUniverseActive(dto.universeId);

    const created = await prisma.audit_Plan_Item.create({
      data: {
        plan_id: planId,
        universe_id: dto.universeId,
        planned_start_date: new Date(dto.plannedStartDate),
        planned_end_date: new Date(dto.plannedEndDate),
        priority: dto.priority,
        notes: dto.notes ?? null,
      },
    });

    logger.info('Audit plan item added', { planId, itemId: created.id, universeId: dto.universeId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.plan.item.add',
      module: 'audit',
      entityType: 'audit_plan_item',
      entityId: created.id,
      newValues: dto,
    });

    return this.getPlanById(planId);
  }

  async bulkAddPlanItems(planId: string, dto: BulkAddPlanItemsRequestDto, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasPermission(actor.permissions, 'plan:add_item');
    await this._assertDraftPlan(planId);

    const uniqueUniverseIds = [...new Set(dto.items.map((i) => i.universeId))];
    const universeRows = await prisma.audit_Universe.findMany({
      where: { id: { in: uniqueUniverseIds }, deleted_at: null },
      select: { id: true, name: true, status: true },
    });
    const byId = new Map(universeRows.map((u) => [u.id, u]));

    for (const universeId of uniqueUniverseIds) {
      const entity = byId.get(universeId);
      if (!entity) throw AppError.notFound('Audit universe entity');
      if (entity.status !== UniverseStatus.Active) {
        throw AppError.badRequest(
          `Auditable entity '${entity.name}' is inactive and cannot be added to an audit programme`,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.audit_Plan_Item.createMany({
        data: dto.items.map((item) => ({
          plan_id: planId,
          universe_id: item.universeId,
          planned_start_date: new Date(item.plannedStartDate),
          planned_end_date: new Date(item.plannedEndDate),
          priority: item.priority,
          notes: item.notes ?? null,
        })),
      });
    });

    logger.info('Audit plan items bulk added', { planId, count: dto.items.length, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.plan.item.bulk_add',
      module: 'audit',
      entityType: 'audit_plan',
      entityId: planId,
      newValues: { count: dto.items.length, universeIds: uniqueUniverseIds },
    });

    return this.getPlanById(planId);
  }

  async updatePlanItem(
    planId: string,
    itemId: string,
    dto: UpdatePlanItemRequestDto,
    actor: ActorContext,
  ): Promise<PlanResponseDto> {
    assertHasPermission(actor.permissions, 'plan:add_item');
    await this._assertDraftPlan(planId);

    const existing = await prisma.audit_Plan_Item.findFirst({
      where: { id: itemId, plan_id: planId },
    });
    if (!existing) throw AppError.notFound('Audit plan item');
    if (existing.engagement_created) {
      throw AppError.badRequest('Cannot edit a plan item after an engagement has been created');
    }

    if (dto.universeId !== undefined && dto.universeId !== existing.universe_id) {
      await this._assertUniverseActive(dto.universeId);
    }

    const nextStart = dto.plannedStartDate ? new Date(dto.plannedStartDate) : existing.planned_start_date;
    const nextEnd = dto.plannedEndDate ? new Date(dto.plannedEndDate) : existing.planned_end_date;
    if (nextStart > nextEnd) {
      throw AppError.badRequest('Planned end date must be on or after planned start date');
    }

    const updated = await prisma.audit_Plan_Item.update({
      where: { id: itemId },
      data: {
        ...(dto.universeId !== undefined && { universe_id: dto.universeId }),
        ...(dto.plannedStartDate !== undefined && { planned_start_date: nextStart }),
        ...(dto.plannedEndDate !== undefined && { planned_end_date: nextEnd }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    logger.info('Audit plan item updated', { planId, itemId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.plan.item.update',
      module: 'audit',
      entityType: 'audit_plan_item',
      entityId: itemId,
      oldValues: {
        universeId: existing.universe_id,
        priority: existing.priority,
        plannedStartDate: existing.planned_start_date.toISOString(),
        plannedEndDate: existing.planned_end_date.toISOString(),
        notes: existing.notes,
      },
      newValues: {
        universeId: updated.universe_id,
        priority: updated.priority,
        plannedStartDate: updated.planned_start_date.toISOString(),
        plannedEndDate: updated.planned_end_date.toISOString(),
        notes: updated.notes,
      },
    });

    return this.getPlanById(planId);
  }

  async removePlanItem(planId: string, itemId: string, actor: ActorContext): Promise<void> {
    assertHasPermission(actor.permissions, 'plan:add_item');
    await this._assertDraftPlan(planId);

    const item = await prisma.audit_Plan_Item.findFirst({
      where: { id: itemId, plan_id: planId },
    });
    if (!item) throw AppError.notFound('Audit plan item');
    if (item.engagement_created) {
      throw AppError.badRequest('Cannot remove a plan item after an engagement has been created');
    }

    await prisma.audit_Plan_Item.delete({ where: { id: itemId } });

    logger.info('Audit plan item removed', { planId, itemId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.plan.item.remove',
      module: 'audit',
      entityType: 'audit_plan_item',
      entityId: itemId,
      oldValues: {
        planId,
        universeId: item.universe_id,
        priority: item.priority,
        plannedStartDate: item.planned_start_date.toISOString(),
        plannedEndDate: item.planned_end_date.toISOString(),
        notes: item.notes,
      },
    });
  }

  async submitPlanForApproval(planId: string, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasPermission(actor.permissions, 'plan:submit');
    const plan = await this._getPlanForMutation(planId);
    if (!PLAN_EDITABLE_STATUSES.includes(plan.status as PlanStatus)) {
      throw AppError.badRequest('Only draft or rejected plans can be submitted');
    }
    if (plan.items.length === 0) throw AppError.badRequest('Plan must have at least one item before submission');

    const { submittedPlan, approval } = await prisma.$transaction(async (tx) => {
      const submittedPlan = await tx.audit_Plan.update({
        where: { id: planId },
        data: { status: PlanStatus.Submitted, rejection_reason: null },
        include: planInclude,
      });

      const approval = await this.approvalService.createApproval({
        entityType: WorkflowEntityType.AuditPlan,
        entityId: planId,
      }, actor, tx);

      return { submittedPlan, approval };
    }, { timeout: 15000 });
    this.approvalService.queueApprovalRequiredNotification(approval);
    logger.info('Audit plan submitted', { planId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.plan.submit', module: 'audit', entityType: 'audit_plan', entityId: planId });
    return mapPlanToResponse(submittedPlan);
  }

  async approvePlan(planId: string, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasPermission(actor.permissions, 'plan:approve');
    const plan = await this._getPlanForMutation(planId);
    if (plan.status !== PlanStatus.Submitted) throw AppError.badRequest('Only submitted plans can be approved');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditPlan, planId);
    await this.approvalService.approve(approval.id, actor);
    const updated = await this.getPlanById(planId);

    logger.info('Audit plan approved', { planId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.plan.approve', module: 'audit', entityType: 'audit_plan', entityId: planId });
    return updated;
  }

  async rejectPlan(planId: string, reason: string, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasPermission(actor.permissions, 'plan:reject');
    const plan = await this._getPlanForMutation(planId);
    if (plan.status !== PlanStatus.Submitted) throw AppError.badRequest('Only submitted plans can be rejected');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditPlan, planId);
    await this.approvalService.reject(approval.id, actor, reason);
    const updated = await this.getPlanById(planId);

    logger.info('Audit plan rejected', { planId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.plan.reject', module: 'audit', entityType: 'audit_plan', entityId: planId, newValues: { reason } });
    return updated;
  }

  async getPlanById(id: string): Promise<PlanResponseDto> {
    const plan = await prisma.audit_Plan.findFirst({
      where: { id, deleted_at: null },
      include: planInclude,
    });
    if (!plan) throw AppError.notFound('Audit plan');
    return mapPlanToResponse(plan);
  }

  async listPlans(query: PlanQueryDto): Promise<{ plans: PlanResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where: Prisma.Audit_PlanWhereInput = {
      deleted_at: null,
      ...(query.status && { status: query.status }),
      ...(query.year !== undefined && { year: query.year }),
      ...(query.auditType && { audit_type: query.auditType }),
      // SQL Server's default collation is case-insensitive, so `contains`
      // already behaves the way users expect from a search box.
      ...(query.search && { title: { contains: query.search } }),
    };

    const [total, plans] = await prisma.$transaction([
      prisma.audit_Plan.count({ where }),
      prisma.audit_Plan.findMany({
        where,
        include: {
          _count: { select: { items: true } },
          approved_by: { select: { display_name: true, first_name: true, last_name: true } },
        },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return { plans: plans.map((plan) => mapPlanToResponse(plan)), meta: buildPaginationMeta(total, page, pageSize) };
  }

  private async _getPlanForMutation(planId: string) {
    const plan = await prisma.audit_Plan.findFirst({
      where: { id: planId, deleted_at: null },
      include: { items: true },
    });
    if (!plan) throw AppError.notFound('Audit plan');
    return plan;
  }

  private async _assertDraftPlan(planId: string): Promise<void> {
    const plan = await prisma.audit_Plan.findFirst({
      where: { id: planId, deleted_at: null },
      select: { status: true },
    });
    if (!plan) throw AppError.notFound('Audit plan');
    if (!PLAN_EDITABLE_STATUSES.includes(plan.status as PlanStatus)) {
      throw AppError.badRequest('Plan must be in draft or rejected status to be changed');
    }
  }

  private async _assertUniverseActive(universeId: string): Promise<void> {
    const universe = await prisma.audit_Universe.findFirst({
      where: { id: universeId, deleted_at: null },
      select: { id: true, name: true, status: true },
    });
    if (!universe) throw AppError.notFound('Audit universe entity');
    if (universe.status !== UniverseStatus.Active) {
      throw AppError.badRequest(
        `Auditable entity '${universe.name}' is inactive and cannot be added to an audit programme`,
      );
    }
  }
}
