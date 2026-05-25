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
import { WORKFLOW_ADMIN_ROLES, assertHasPermission } from '../../../utility/workflow.utility';
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
        select: { id: true, title: true, reference_number: true, sla_deadline: true },
      }),
      prisma.user.findFirst({
        where: { id: dto.userId, deleted_at: null, is_active: true },
        select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
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

    const assignment = await prisma.workflow_Assignment.create({
      data: {
        engagement_id: dto.engagementId,
        user_id: dto.userId,
        role: dto.role,
        assigned_by_id: assignedBy.id,
      },
      include: assignmentInclude,
    });

    const assigneeName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
    const assignmentVariables = {
      assigneeName,
      engagementTitle: engagement.title,
      engagementReference: engagement.reference_number,
      assignmentRole: dto.role,
      slaDeadline: engagement.sla_deadline.toISOString(),
    };

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
    );

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

    await prisma.workflow_Assignment.delete({ where: { id: assignmentId } });

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
    );

    await notificationQueueService.enqueue(
      'email',
      {
        to: assignment.user.email,
        subject: 'Audit assignment removed',
        text: `You have been unassigned from ${assignment.engagement.title}.`,
      },
    );

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

  async getAssignments(engagementId: string): Promise<AssignmentResponseDto[]> {
    const assignments = await prisma.workflow_Assignment.findMany({
      where: { engagement_id: engagementId },
      include: assignmentInclude,
      orderBy: { assigned_at: 'asc' },
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
          status: { notIn: ['reported', 'closed'] },
        },
      },
      select: { engagement: { select: { status: true } } },
    });

    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      const status = assignment.engagement.status;
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    return {
      userId,
      totalActive: assignments.length,
      byStatus: Array.from(counts.entries()).map(([status, count]) => ({ status, count })),
    };
  }

  async getCandidates(engagementId: string): Promise<AssignmentCandidateDto[]> {
    // Get already-assigned user IDs for this engagement
    const existingAssignments = await prisma.workflow_Assignment.findMany({
      where: { engagement_id: engagementId },
      select: { user_id: true },
    });
    const assignedIds = new Set(existingAssignments.map(a => a.user_id));

    // Get all active users
    const users = await prisma.user.findMany({
      where: { deleted_at: null, is_active: true },
      select: {
        id: true,
        display_name: true,
        first_name: true,
        last_name: true,
        email: true,
        department: true,
        job_title: true,
        skills: true,
      },
    });

    // Get active engagement counts per user
    const activeAssignments = await prisma.workflow_Assignment.groupBy({
      by: ['user_id'],
      where: {
        engagement: {
          status: { in: ['planned', 'in_progress', 'under_review'] },
          deleted_at: null,
        },
      },
      _count: { user_id: true },
    });
    const workloadMap = new Map(activeAssignments.map(a => [a.user_id, a._count.user_id]));

    return users
      .filter(u => !assignedIds.has(u.id))
      .map(u => ({
        id: u.id,
        displayName: u.display_name || `${u.first_name} ${u.last_name}`.trim(),
        email: u.email,
        department: u.department,
        jobTitle: u.job_title,
        skills: parseSkillsJson(u.skills),
        activeEngagementCount: workloadMap.get(u.id) ?? 0,
      }));
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
