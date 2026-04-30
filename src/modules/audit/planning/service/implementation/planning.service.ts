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
import { PlanStatus } from '../../../domain/enum/audit.enum';
import { AUDIT_ADMIN_ROLES, assertHasRole } from '../../../utility/audit.utility';
import {
  AddPlanItemRequestDto,
  CreatePlanRequestDto,
  PlanQueryDto,
} from '../../dto/request/planning.request.dto';
import { PlanResponseDto, mapPlanToResponse } from '../../dto/response/planning.response.dto';
import { IPlanningService } from '../interface/planning.service.interface';

const planInclude = {
  items: { include: { universe: true }, orderBy: { created_at: 'asc' as const } },
};

export class PlanningService implements IPlanningService {
  constructor(private readonly approvalService: IApprovalService = workflowApprovalService) {}

  async createPlan(dto: CreatePlanRequestDto, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);

    const existingCount = await prisma.audit_Plan.count({
      where: { year: dto.year, deleted_at: null },
    });

    const plan = await prisma.audit_Plan.create({
      data: {
        title: dto.title,
        year: dto.year,
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
      existingCount > 0 ? [`A plan for ${dto.year} already exists`] : undefined,
    );
  }

  async addPlanItem(planId: string, dto: AddPlanItemRequestDto, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    await this._assertDraftPlan(planId);
    await this._assertUniverseExists(dto.universeId);

    await prisma.audit_Plan_Item.create({
      data: {
        plan_id: planId,
        universe_id: dto.universeId,
        audit_type: dto.auditType,
        planned_start_date: new Date(dto.plannedStartDate),
        planned_end_date: new Date(dto.plannedEndDate),
        priority: dto.priority,
      },
    });

    logger.info('Audit plan item added', { planId, universeId: dto.universeId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.plan.item.add',
      module: 'audit',
      entityType: 'audit_plan',
      entityId: planId,
      newValues: dto,
    });

    return this.getPlanById(planId);
  }

  async removePlanItem(planId: string, itemId: string, actor: ActorContext): Promise<void> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
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
    });
  }

  async submitPlanForApproval(planId: string, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    const plan = await this._getPlanForMutation(planId);
    if (plan.status !== PlanStatus.Draft) throw AppError.badRequest('Only draft plans can be submitted');
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
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    const plan = await this._getPlanForMutation(planId);
    if (plan.status !== PlanStatus.Submitted) throw AppError.badRequest('Only submitted plans can be approved');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditPlan, planId);
    await this.approvalService.approve(approval.id, actor.id);
    const updated = await this.getPlanById(planId);

    logger.info('Audit plan approved', { planId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.plan.approve', module: 'audit', entityType: 'audit_plan', entityId: planId });
    return updated;
  }

  async rejectPlan(planId: string, reason: string, actor: ActorContext): Promise<PlanResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    const plan = await this._getPlanForMutation(planId);
    if (plan.status !== PlanStatus.Submitted) throw AppError.badRequest('Only submitted plans can be rejected');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditPlan, planId);
    await this.approvalService.reject(approval.id, actor.id, reason);
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
    };

    const [total, plans] = await prisma.$transaction([
      prisma.audit_Plan.count({ where }),
      prisma.audit_Plan.findMany({
        where,
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
    if (plan.status !== PlanStatus.Draft) throw AppError.badRequest('Plan must be in draft status');
  }

  private async _assertUniverseExists(universeId: string): Promise<void> {
    const universe = await prisma.audit_Universe.findFirst({
      where: { id: universeId, deleted_at: null },
      select: { id: true },
    });
    if (!universe) throw AppError.notFound('Audit universe entity');
  }

}
