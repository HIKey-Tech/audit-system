import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { WorkflowAssignmentRole } from '../../../domain/enum/workflow.enum';
import { assertHasPermission } from '../../../utility/workflow.utility';
import {
  ACTIVE_ENGAGEMENT_STATUSES,
  MAX_CONCURRENT_ENGAGEMENTS,
  getMatchedSkills,
  getRecommendationScore,
  getSkillScore,
  rangesOverlap,
} from '../../utility/assignment-matching.util';
import { AssignStaffRequestDto, MyAssignmentsQueryDto } from '../../dto/request/assignment.request.dto';
import {
  AssignmentResponseDto,
  WorkloadResponseDto,
  AssignmentCandidateDto,
  mapAssignmentToResponse,
} from '../../dto/response/assignment.response.dto';
import { IAssignmentService } from '../interface/assignment.service.interface';

const workflowUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  display_name: true,
  first_name: true,
  last_name: true,
  department: true,
  job_title: true,
});

const assignmentInclude = Prisma.validator<Prisma.Workflow_AssignmentInclude>()({
  user: { select: workflowUserSelect },
  assigned_by: { select: workflowUserSelect },
  engagement: true,
});

export class AssignmentService implements IAssignmentService {
  async assignStaff(dto: AssignStaffRequestDto, assignedBy: WorkflowActorContext): Promise<AssignmentResponseDto> {
    assertHasPermission(assignedBy.permissions, 'assignment:create');

    const [engagement, user, existing] = await prisma.$transaction([
      prisma.audit_Engagement.findFirst({
        where: { id: dto.engagementId, deleted_at: null },
        select: {
          id: true,
          title: true,
          reference_number: true,
          sla_deadline: true,
          planned_start_date: true,
          planned_end_date: true,
        },
      }),
      prisma.user.findFirst({
        where: { id: dto.userId, deleted_at: null, is_active: true },
        select: { id: true, email: true, display_name: true, first_name: true, last_name: true, max_concurrent_engagements: true },
      }),
      prisma.workflow_Assignment.findFirst({
        where: {
          engagement_id: dto.engagementId,
          user_id: dto.userId,
          role: dto.role,
        },
        select: { id: true },
      }),
    ]);

    if (!engagement) throw AppError.notFound('Audit engagement');
    if (!user) throw AppError.notFound('User');
    if (existing) throw AppError.conflict('User is already assigned to this engagement in that role');

    // Capacity + schedule guard: block over-allocating an auditor across
    // engagements whose planned windows overlap this one.
    const otherActive = await prisma.workflow_Assignment.findMany({
      where: {
        user_id: dto.userId,
        engagement: {
          id: { not: dto.engagementId },
          deleted_at: null,
          status: { in: ACTIVE_ENGAGEMENT_STATUSES },
        },
      },
      select: {
        engagement: { select: { planned_start_date: true, planned_end_date: true } },
      },
    });
    const overlapping = otherActive.filter((a) =>
      rangesOverlap(
        engagement.planned_start_date,
        engagement.planned_end_date,
        a.engagement.planned_start_date,
        a.engagement.planned_end_date,
      ),
    );
    const capacity = user.max_concurrent_engagements ?? MAX_CONCURRENT_ENGAGEMENTS;
    if (overlapping.length >= capacity) {
      throw AppError.conflict(
        `User already has ${overlapping.length} engagements overlapping this period (capacity is ${capacity}).`,
      );
    }

    const assigneeName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
    const assignmentVariables = {
      assigneeName,
      engagementTitle: engagement.title,
      engagementReference: engagement.reference_number,
      assignmentRole: dto.role,
      slaDeadline: engagement.sla_deadline.toISOString(),
    };

    // Transactional outbox: the assignment row and its notifications commit
    // together, so a queue-write failure can never leave a silent assignment.
    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.workflow_Assignment.create({
        data: {
          engagement_id: dto.engagementId,
          user_id: dto.userId,
          role: dto.role,
          assigned_by_id: assignedBy.id,
        },
        include: assignmentInclude,
      });

      await notificationQueueService.enqueue(
        'in_app',
        {
          userId: dto.userId,
          title: 'Audit assignment',
          body: `You have been assigned to ${engagement.title} as ${dto.role}.`,
          type: 'info',
          referenceType: 'audit_engagement',
          referenceId: dto.engagementId,
          eventKey: 'workflow.assignment.created',
          variables: assignmentVariables,
        },
        { tx },
      );

      await notificationQueueService.enqueue(
        'email',
        {
          to: user.email,
          subject: 'Audit assignment',
          text: `You have been assigned to ${engagement.title} as ${dto.role}.`,
          eventKey: 'workflow.assignment.created',
          variables: assignmentVariables,
        },
        { tx },
      );

      return created;
    });

    logger.info('Workflow assignment created', {
      assignmentId: assignment.id,
      engagementId: dto.engagementId,
      userId: dto.userId,
      actorId: assignedBy.id,
    });
    auditLogService.logAsync({
      userId: assignedBy.id,
      action: 'workflow.assignment.create',
      module: 'workflow',
      entityType: 'audit_engagement',
      entityId: dto.engagementId,
      newValues: dto,
    });

    return mapAssignmentToResponse(assignment);
  }

  async removeAssignment(assignmentId: string, removedBy: WorkflowActorContext): Promise<void> {
    assertHasPermission(removedBy.permissions, 'assignment:delete');

    const assignment = await prisma.workflow_Assignment.findUnique({
      where: { id: assignmentId },
      include: {
        user: { select: { id: true, email: true } },
        engagement: { select: { id: true, title: true } },
      },
    });
    if (!assignment) throw AppError.notFound('Workflow assignment');

    await prisma.$transaction(async (tx) => {
      await tx.workflow_Assignment.delete({ where: { id: assignmentId } });

      await notificationQueueService.enqueue(
        'in_app',
        {
          userId: assignment.user_id,
          title: 'Audit assignment removed',
          body: `You have been unassigned from ${assignment.engagement.title}.`,
          type: 'warning',
          referenceType: 'audit_engagement',
          referenceId: assignment.engagement_id,
        },
        { tx },
      );

      await notificationQueueService.enqueue(
        'email',
        {
          to: assignment.user.email,
          subject: 'Audit assignment removed',
          text: `You have been unassigned from ${assignment.engagement.title}.`,
        },
        { tx },
      );
    });

    logger.info('Workflow assignment removed', { assignmentId, actorId: removedBy.id });
    auditLogService.logAsync({
      userId: removedBy.id,
      action: 'workflow.assignment.remove',
      module: 'workflow',
      entityType: 'audit_engagement',
      entityId: assignment.engagement_id,
      oldValues: { userId: assignment.user_id, role: assignment.role },
    });
  }

  async getAssignments(engagementId: string, actor: WorkflowActorContext): Promise<AssignmentResponseDto[]> {
    await this._assertCanViewEngagementAssignments(engagementId, actor);
    const assignments = await prisma.workflow_Assignment.findMany({
      where: { engagement_id: engagementId },
      include: assignmentInclude,
      orderBy: { assigned_at: 'asc' },
    });
    return assignments.map(mapAssignmentToResponse);
  }

  /**
   * Assignments the actor can see and manage: oversight (engagement:read_all)
   * sees every assignment; otherwise assignments on engagements the actor leads,
   * manages, or is assigned to. This is the management view behind the
   * Assignments page — distinct from `getMyAssignments`, which is the actor's
   * own personal assignments only. Without this, a manager who assigns staff
   * could never see the assignments they created.
   */
  async getVisibleAssignments(actor: WorkflowActorContext): Promise<AssignmentResponseDto[]> {
    const isOversight = actor.permissions.includes('engagement:read_all');
    const where: Prisma.Workflow_AssignmentWhereInput = {
      engagement: {
        deleted_at: null,
        ...(isOversight
          ? {}
          : {
              OR: [
                { lead_auditor_id: actor.id },
                { audit_manager_id: actor.id },
                { workflow_assignments: { some: { user_id: actor.id } } },
              ],
            }),
      },
    };

    const assignments = await prisma.workflow_Assignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: { assigned_at: 'desc' },
    });
    return assignments.map(mapAssignmentToResponse);
  }

  async getMyAssignments(
    userId: string,
    filters: MyAssignmentsQueryDto,
  ): Promise<{ assignments: AssignmentResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(filters);
    const where: Prisma.Workflow_AssignmentWhereInput = {
      user_id: userId,
      engagement: {
        deleted_at: null,
        ...(filters.status && { status: filters.status }),
      },
    };

    const [total, assignments] = await prisma.$transaction([
      prisma.workflow_Assignment.count({ where }),
      prisma.workflow_Assignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: { assigned_at: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      assignments: assignments.map(mapAssignmentToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async getUserWorkload(userId: string): Promise<WorkloadResponseDto> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null, is_active: true },
      select: { id: true },
    });
    if (!user) throw AppError.notFound('User');

    const assignments = await prisma.workflow_Assignment.findMany({
      where: {
        user_id: userId,
        engagement: {
          deleted_at: null,
          status: { in: ACTIVE_ENGAGEMENT_STATUSES },
        },
      },
      select: { engagement: { select: { status: true } } },
    });

    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      const status = assignment.engagement.status;
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    const loggedTime = await prisma.audit_Time_Entry.aggregate({
      where: {
        user_id: userId,
        deleted_at: null,
        engagement: { deleted_at: null, status: { in: ACTIVE_ENGAGEMENT_STATUSES } },
      },
      _sum: { hours: true },
    });

    return {
      userId,
      totalActive: assignments.length,
      byStatus: Array.from(counts.entries()).map(([status, count]) => ({ status, count })),
      loggedHours: Number(loggedTime._sum.hours ?? 0),
    };
  }

  async getCandidates(
    engagementId: string,
    actor: WorkflowActorContext,
    opts?: { search?: string; limit?: number },
  ): Promise<AssignmentCandidateDto[]> {
    assertHasPermission(actor.permissions, 'assignment:create');
    // Need the engagement's audit type + priority to score skill fit and weight workload.
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, audit_type: true, priority: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    const search = opts?.search?.trim();
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);

    // Already-assigned users are excluded at the DB so `take` returns a full page.
    const existingAssignments = await prisma.workflow_Assignment.findMany({
      where: { engagement_id: engagementId },
      select: { user_id: true },
    });
    const assignedIds = existingAssignments.map(a => a.user_id);

    // ponytail: skill ranking is over the loaded page (search filter + `take: limit`),
    // not the whole directory — `skills` is JSON we can't rank in SQL, and loading every
    // AD-synced user on each picker open was the slow path. Type a name to find anyone.
    const userWhere: Prisma.UserWhereInput = {
      deleted_at: null,
      is_active: true,
      id: { notIn: assignedIds },
      ...(search
        ? {
            OR: [
              { display_name: { contains: search } },
              { first_name: { contains: search } },
              { last_name: { contains: search } },
              { email: { contains: search } },
              { department: { contains: search } },
            ],
          }
        : {}),
    };

    // Candidate page + org-wide active-workload counts run in parallel.
    const [users, activeAssignments] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          display_name: true,
          first_name: true,
          last_name: true,
          email: true,
          department: true,
          job_title: true,
          skills: true,
          max_concurrent_engagements: true,
        },
        orderBy: [{ display_name: 'asc' }, { created_at: 'asc' }],
        take: limit,
      }),
      prisma.workflow_Assignment.groupBy({
        by: ['user_id'],
        where: {
          engagement: {
            status: { in: ACTIVE_ENGAGEMENT_STATUSES },
            deleted_at: null,
          },
        },
        _count: { user_id: true },
      }),
    ]);
    const workloadMap = new Map(activeAssignments.map(a => [a.user_id, a._count.user_id]));

    return users
      .map(u => {
        const skills = parseSkillsJson(u.skills);
        const activeEngagementCount = workloadMap.get(u.id) ?? 0;
        const matchedSkills = getMatchedSkills(skills, engagement.audit_type);
        const skillScore = getSkillScore(skills, engagement.audit_type);
        const capacity = u.max_concurrent_engagements ?? MAX_CONCURRENT_ENGAGEMENTS;
        const overCapacity = activeEngagementCount >= capacity;
        return {
          id: u.id,
          displayName: u.display_name || `${u.first_name} ${u.last_name}`.trim(),
          email: u.email,
          department: u.department,
          jobTitle: u.job_title,
          skills,
          activeEngagementCount,
          matchedSkills,
          recommendationScore: getRecommendationScore(skillScore, activeEngagementCount, engagement.priority),
          recommended: skillScore > 0 && !overCapacity,
          overCapacity,
        };
      })
      .sort((a, b) =>
        b.recommendationScore - a.recommendationScore ||
        a.activeEngagementCount - b.activeEngagementCount,
      );
  }
  private async _assertCanViewEngagementAssignments(
    engagementId: string,
    actor: WorkflowActorContext,
  ): Promise<void> {
    if (actor.permissions.includes('engagement:read_all')) return;

    const count = await prisma.audit_Engagement.count({
      where: {
        id: engagementId,
        deleted_at: null,
        OR: [
          { lead_auditor_id: actor.id },
          { audit_manager_id: actor.id },
          { workflow_assignments: { some: { user_id: actor.id } } },
        ],
      },
    });
    if (count === 0) {
      throw AppError.forbidden('You do not have access to this engagement assignments');
    }
  }

  async getActiveWorkloadMap(): Promise<Map<string, number>> {
    const grouped = await prisma.workflow_Assignment.groupBy({
      by: ['user_id'],
      where: {
        engagement: {
          status: { in: ACTIVE_ENGAGEMENT_STATUSES },
          deleted_at: null,
        },
      },
      _count: { user_id: true },
    });
    return new Map(grouped.map(a => [a.user_id, a._count.user_id]));
  }
}

export const workflowAssignmentService = new AssignmentService();

function parseSkillsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s: unknown) => typeof s === 'string' && s.length > 0)
      : [];
  } catch {
    return [];
  }
}
