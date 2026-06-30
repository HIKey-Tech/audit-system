import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext, ChecklistProgress, FindingSeverityCount, FindingStats, WorkingPaperStats } from '../../../domain/entity/audit.entity';
import { EngagementStatus, FindingStatus, PlanStatus } from '../../../domain/enum/audit.enum';
import {
  ENGAGEMENT_TRANSITIONS,
  assertHasPermission,
  assertTransition,
  buildReferenceNumber,
  parseReferenceSequence,
} from '../../../utility/audit.utility';
import { getAuditLifecycleRules, serializeChecklistControls } from '../../../utility/audit-config.utility';
import { resolveViewerContext } from '../../utility/engagement-visibility.util';
import { IChecklistService } from '../../../checklists/service/interface/checklist.service.interface';
import { IUserService } from '../../../../user';
import { UserQueryDto } from '../../../../user/dto/request/user.request.dto';
import { IAssignmentService } from '../../../../workflow/assignment/service/interface/assignment.service.interface';
import {
  MAX_CONCURRENT_ENGAGEMENTS,
  getMatchedSkills,
  getRecommendationScore,
  getSkillScore,
} from '../../../../workflow/assignment/utility/assignment-matching.util';
import {
  CreateAdhocEngagementRequestDto,
  CreateEngagementFromPlanRequestDto,
  EligibleUsersQueryDto,
  EngagementQueryDto,
  UpdateEngagementRequestDto,
} from '../../dto/request/engagement.request.dto';
import { EligibleUserDto, EngagementResponseDto, mapEngagementToResponse } from '../../dto/response/engagement.response.dto';
import { IEngagementService } from '../interface/engagement.service.interface';

/**
 * Permissions an engagement's audit manager must hold: they are the pinned
 * approver for the engagement's working papers and the first-level approver for
 * its report, so without these the approval chain would dead-end.
 */
const MANAGER_APPROVAL_PERMISSIONS = ['working_paper:approve', 'report:approve', 'finding:close'] as const;

/**
 * Permission a lead auditor must hold: they run fieldwork on the engagement and
 * author its working papers. This is the minimum "is an auditor" gate — it
 * admits the `auditor`, `audit_lead` and `audit_manager` roles while excluding
 * auditees, viewers and non-audit staff who can't produce working papers.
 */
const LEAD_AUDITOR_PERMISSIONS = ['working_paper:create'] as const;

const userNameSelect = { select: { id: true, first_name: true, last_name: true, display_name: true } };

const engagementInclude = {
  universe: true,
  plan_item: { include: { plan: { select: { id: true, title: true } } } },
  lead_auditor: userNameSelect,
  audit_manager: userNameSelect,
  auditee: userNameSelect,
};

export class EngagementService implements IEngagementService {
  constructor(
    private readonly checklistService: IChecklistService,
    private readonly userService: IUserService,
    private readonly assignmentService: IAssignmentService,
  ) {}

  private async _assertManagerCanApprove(managerId: string): Promise<void> {
    const manager = await this.userService.getUserById(managerId);
    if (!manager.isActive) throw AppError.badRequest('Assigned audit manager account is deactivated');
    const missing = MANAGER_APPROVAL_PERMISSIONS.filter((slug) => !manager.permissions.includes(slug));
    if (missing.length > 0) {
      throw AppError.badRequest(
        `Assigned audit manager must hold approval permissions: ${missing.join(', ')}`,
      );
    }
  }

  private async _assertLeadAuditorEligible(leadAuditorId: string): Promise<void> {
    const lead = await this.userService.getUserById(leadAuditorId);
    if (!lead.isActive) throw AppError.badRequest('Assigned lead auditor account is deactivated');
    const missing = LEAD_AUDITOR_PERMISSIONS.filter((slug) => !lead.permissions.includes(slug));
    if (missing.length > 0) {
      throw AppError.badRequest(
        `Assigned lead auditor must hold fieldwork permissions: ${missing.join(', ')}`,
      );
    }
  }

  private async _assertUniverseActive(universeId: string): Promise<void> {
    const universe = await prisma.audit_Universe.findFirst({
      where: { id: universeId, deleted_at: null },
      select: { id: true },
    });
    if (!universe) throw AppError.badRequest('Universe entity does not exist or has been deleted');
  }

  private async _assertAuditeeActive(auditeeId: string | undefined | null): Promise<void> {
    if (!auditeeId) return;
    const auditee = await this.userService.getUserById(auditeeId);
    if (!auditee.isActive) throw AppError.badRequest('Assigned auditee account is deactivated');
  }

  async getEligibleUsers(query: EligibleUsersQueryDto): Promise<EligibleUserDto[]> {
    const requiredPermissions =
      query.role === 'audit_manager' ? MANAGER_APPROVAL_PERMISSIONS : LEAD_AUDITOR_PERMISSIONS;

    const userQuery: UserQueryDto = {
      page: 1,
      pageSize: 100,
      isActive: true,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };
    const [{ users }, workloadMap] = await Promise.all([
      this.userService.listUsers(userQuery),
      this.assignmentService.getActiveWorkloadMap(),
    ]);

    const auditType = query.auditType ?? '';
    const priority = query.priority ?? 'medium';

    return users
      .filter((u) => u.isActive && requiredPermissions.every((p) => u.permissions.includes(p)))
      .map((u) => {
        const activeEngagementCount = workloadMap.get(u.id) ?? 0;
        const matchedSkills = getMatchedSkills(u.skills, auditType);
        const skillScore = getSkillScore(u.skills, auditType);
        const capacity = u.maxConcurrentEngagements ?? MAX_CONCURRENT_ENGAGEMENTS;
        const overCapacity = activeEngagementCount >= capacity;
        return {
          id: u.id,
          displayName: u.displayName || `${u.firstName} ${u.lastName}`.trim(),
          department: u.department,
          jobTitle: u.jobTitle,
          skills: u.skills,
          matchedSkills,
          activeEngagementCount,
          recommendationScore: getRecommendationScore(skillScore, activeEngagementCount, priority),
          recommended: skillScore > 0 && !overCapacity,
          overCapacity,
        };
      })
      .sort(
        (a, b) =>
          b.recommendationScore - a.recommendationScore ||
          a.activeEngagementCount - b.activeEngagementCount,
      );
  }

  async createFromPlanItem(
    planItemId: string,
    dto: CreateEngagementFromPlanRequestDto,
    actor: ActorContext,
  ): Promise<EngagementResponseDto> {
    assertHasPermission(actor.permissions, 'engagement:create');

    const planItem = await prisma.audit_Plan_Item.findUnique({
      where: { id: planItemId },
      include: { plan: true },
    });
    if (!planItem) throw AppError.notFound('Audit plan item');
    if (planItem.plan.status !== PlanStatus.Approved) throw AppError.badRequest('Plan must be approved before creating an engagement');
    if (planItem.engagement_created) throw AppError.conflict('An engagement has already been created from this plan item');
    await this._assertManagerCanApprove(dto.auditManagerId);
    await this._assertLeadAuditorEligible(dto.leadAuditorId);
    await this._assertAuditeeActive(dto.auditeeId);

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
          checklist_template: serializeChecklistControls(dto.checklistControls),
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
    assertHasPermission(actor.permissions, 'engagement:create');
    if (!dto.adhocReason) throw AppError.badRequest('Ad-hoc reason is required');
    await this._assertUniverseActive(dto.universeId);
    await this._assertManagerCanApprove(dto.auditManagerId);
    await this._assertLeadAuditorEligible(dto.leadAuditorId);
    await this._assertAuditeeActive(dto.auditeeId);

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
        checklist_template: serializeChecklistControls(dto.checklistControls),
        created_by_id: actor.id,
      },
      include: engagementInclude,
    });

    logger.info('Ad-hoc audit engagement created', { engagementId: engagement.id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.create_adhoc', module: 'audit', entityType: 'audit_engagement', entityId: engagement.id });
    return mapEngagementToResponse(engagement);
  }

  async updateEngagement(id: string, dto: UpdateEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto> {
    assertHasPermission(actor.permissions, 'engagement:update');
    await this._assertEngagementExists(id);
    if (dto.auditManagerId !== undefined) await this._assertManagerCanApprove(dto.auditManagerId);
    if (dto.leadAuditorId !== undefined) await this._assertLeadAuditorEligible(dto.leadAuditorId);

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
    assertHasPermission(actor.permissions, 'engagement:update');
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id, deleted_at: null },
      include: engagementInclude,
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    assertTransition(engagement.status as EngagementStatus, newStatus, ENGAGEMENT_TRANSITIONS, 'engagement');
    await this._assertLifecycleGate(id, newStatus);

    const lifecycleRules = await getAuditLifecycleRules();
    if (newStatus === EngagementStatus.Closed && lifecycleRules.requireClosedFindingsBeforeClose) {
      const openFindingCount = await prisma.audit_Finding.count({
        where: {
          engagement_id: id,
          deleted_at: null,
          status: { not: FindingStatus.Closed },
        },
      });
      if (openFindingCount > 0) throw AppError.badRequest('Cannot close engagement while findings remain open or awaiting closure approval');
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
    return this._withMetrics(updated, actor);
  }

  /**
   * Access scope: unless the actor can read ALL engagements, they may only see
   * engagements they are a party to — lead auditor, audit manager, auditee, or a
   * workflow assignee. Returns undefined for unrestricted (read_all) access.
   */
  private _actorScope(actor: ActorContext): Prisma.Audit_EngagementWhereInput | undefined {
    if (actor.permissions.includes('engagement:read_all')) return undefined;
    return {
      OR: [
        { lead_auditor_id: actor.id },
        { audit_manager_id: actor.id },
        { auditee_id: actor.id },
        { workflow_assignments: { some: { user_id: actor.id } } },
      ],
    };
  }

  /**
   * Active-approver access: a user with a pending approval step they may act on,
   * against one of this engagement's reports / working papers / findings, can open
   * the engagement while that step is open — you can't approve what you can't read.
   */
  private async _hasActiveApprovalAccess(engagementId: string, actor: ActorContext): Promise<boolean> {
    const [reports, papers, findings] = await prisma.$transaction([
      prisma.audit_Report.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
      prisma.audit_Working_Paper.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
      prisma.audit_Finding.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
    ]);
    const entityIds = [...reports, ...papers, ...findings].map((r) => r.id);
    if (entityIds.length === 0) return false;

    const orConditions: Prisma.Workflow_Approval_StepWhereInput[] = [{ approver_id: actor.id }];
    if (actor.permissions.length > 0) {
      orConditions.push({ approver_id: null, required_permission: { in: actor.permissions } });
    }

    const step = await prisma.workflow_Approval_Step.findFirst({
      where: {
        status: 'pending',
        approval: { status: 'pending', entity_id: { in: entityIds } },
        OR: orConditions,
      },
      select: { id: true, level: true, approval: { select: { current_level: true } } },
    });
    return step !== null && step.level === step.approval.current_level;
  }

  async getEngagementById(id: string, actor: ActorContext): Promise<EngagementResponseDto> {
    const scope = this._actorScope(actor);
    let engagement = await prisma.audit_Engagement.findFirst({
      where: { id, deleted_at: null, ...(scope ?? {}) },
      include: engagementInclude,
    });

    // Not an involved party / oversight — allow if they hold a live approval step on it.
    if (!engagement && scope && (await this._hasActiveApprovalAccess(id, actor))) {
      engagement = await prisma.audit_Engagement.findFirst({
        where: { id, deleted_at: null },
        include: engagementInclude,
      });
    }

    if (!engagement) throw AppError.notFound('Audit engagement');
    return this._withMetrics(engagement, actor);
  }

  async listEngagements(query: EngagementQueryDto, actor: ActorContext): Promise<{ engagements: EngagementResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const scope = this._actorScope(actor);
    const where: Prisma.Audit_EngagementWhereInput = {
      deleted_at: null,
      ...(query.status && { status: query.status }),
      ...(query.auditType && { audit_type: query.auditType }),
      ...(query.leadAuditorId && { lead_auditor_id: query.leadAuditorId }),
      ...(query.auditManagerId && { audit_manager_id: query.auditManagerId }),
      ...(scope ?? {}),
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

  private async _withMetrics(
    engagement: Parameters<typeof mapEngagementToResponse>[0],
    actor: ActorContext,
  ): Promise<EngagementResponseDto> {
    const [findingGroups, workingPaperGroups, checklistProgress, report, evidenceCount, assetCount] = await Promise.all([
      prisma.audit_Finding.groupBy({
        by: ['severity'],
        where: { engagement_id: engagement.id, deleted_at: null },
        _count: { _all: true },
      }),
      prisma.audit_Working_Paper.groupBy({
        by: ['status'],
        where: { engagement_id: engagement.id, deleted_at: null },
        _count: { _all: true },
      }),
      this.checklistService.getChecklistProgress(engagement.id),
      prisma.audit_Report.findFirst({
        where: { engagement_id: engagement.id, deleted_at: null },
        select: { status: true },
      }),
      prisma.audit_Evidence.count({ where: { engagement_id: engagement.id } }),
      prisma.audit_Engagement_Asset.count({ where: { engagement_id: engagement.id } }),
    ]);

    const findingStatusGroups = await prisma.audit_Finding.groupBy({
      by: ['status'],
      where: { engagement_id: engagement.id, deleted_at: null },
      _count: { _all: true },
    });

    const findingCounts: FindingSeverityCount[] = findingGroups.map((group) => ({
      severity: group.severity,
      count: group._count._all,
    }));
    const progress: ChecklistProgress = checklistProgress;

    const wpCountByStatus = (status: string): number =>
      workingPaperGroups.find((g) => g.status === status)?._count._all ?? 0;
    const workingPaperCount = workingPaperGroups.reduce((sum, g) => sum + g._count._all, 0);
    const workingPaperStats: WorkingPaperStats = {
      total: workingPaperCount,
      approved: wpCountByStatus('approved'),
      rejected: wpCountByStatus('rejected'),
    };

    const findingTotal = findingStatusGroups.reduce((sum, g) => sum + g._count._all, 0);
    const findingCountByStatus = (status: string): number =>
      findingStatusGroups.find((g) => g.status === status)?._count._all ?? 0;
    const resolvedFindings = findingCountByStatus('closed');
    const findingStats: FindingStats = {
      total: findingTotal,
      open: findingCountByStatus('open'),
      unresolved: findingTotal - resolvedFindings,
    };

    const viewerContext = await resolveViewerContext(
      engagement.id,
      {
        lead_auditor_id: engagement.lead_auditor_id,
        audit_manager_id: engagement.audit_manager_id,
        auditee_id: engagement.auditee_id,
      },
      actor,
    );

    const dto = mapEngagementToResponse(engagement, {
      findingCounts,
      workingPaperCount,
      checklistProgress: progress,
      workingPaperStats,
      findingStats,
      reportStatus: report?.status ?? null,
      evidenceCount,
      assetCount,
    });
    dto.viewerContext = viewerContext;
    return dto;
  }

  private async _assertLifecycleGate(id: string, newStatus: EngagementStatus): Promise<void> {
    const lifecycleRules = await getAuditLifecycleRules();

    if (newStatus === EngagementStatus.UnderReview) {
      if (lifecycleRules.requireAllChecklistsTestedBeforeUnderReview) {
        const [totalChecklistCount, notTestedCount] = await prisma.$transaction([
          prisma.audit_Checklist.count({ where: { engagement_id: id } }),
          prisma.audit_Checklist.count({
            where: { engagement_id: id, result: 'not_tested' },
          }),
        ]);
        if (totalChecklistCount === 0) {
          throw AppError.badRequest('Cannot move engagement to review before checklist procedures are populated');
        }
        if (notTestedCount > 0) {
          throw AppError.badRequest('Cannot move engagement to review while checklist procedures remain untested');
        }
      }

      if (lifecycleRules.requireApprovedWorkingPaperBeforeUnderReview) {
        const [totalPaperCount, unapprovedPaperCount] = await prisma.$transaction([
          prisma.audit_Working_Paper.count({
            where: { engagement_id: id, deleted_at: null },
          }),
          prisma.audit_Working_Paper.count({
            where: { engagement_id: id, deleted_at: null, status: { not: 'approved' } },
          }),
        ]);
        if (totalPaperCount === 0) {
          throw AppError.badRequest('Cannot move engagement to review before at least one working paper is created and approved');
        }
        if (unapprovedPaperCount > 0) {
          throw AppError.badRequest('Cannot move engagement to review while working papers remain unapproved — all working papers must be approved');
        }
      }
    }

    if (newStatus === EngagementStatus.Reported && lifecycleRules.requireReportIssuedBeforeReported) {
      const issuedReportCount = await prisma.audit_Report.count({
        where: {
          engagement_id: id,
          deleted_at: null,
          status: 'issued',
        },
      });
      if (issuedReportCount === 0) {
        throw AppError.badRequest('Cannot mark engagement as reported before an audit report is issued');
      }
    }
  }
}
