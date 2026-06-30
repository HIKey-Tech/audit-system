import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { WorkflowActorContext, WorkflowEscalationRunResult } from '../../../domain/entity/workflow.entity';
import {
  EscalationPolicyAuditType,
  WorkflowApprovalStatus,
  WorkflowApprovalStepStatus,
  WorkflowEscalationEntityType,
  WorkflowEscalationReason,
} from '../../../domain/enum/workflow.enum';
import { assertHasPermission, getEscalationMatrix, hasElapsed } from '../../../utility/workflow.utility';
import { UpsertEscalationPolicyRequestDto } from '../../dto/request/escalation.request.dto';
import {
  EscalationPolicyResponseDto,
  EscalationResponseDto,
  mapEscalationPolicyToResponse,
  mapEscalationToResponse,
} from '../../dto/response/escalation.response.dto';
import { IEscalationService } from '../interface/escalation.service.interface';

const workflowUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  display_name: true,
  first_name: true,
  last_name: true,
  department: true,
  job_title: true,
});

const escalationInclude = Prisma.validator<Prisma.Workflow_EscalationInclude>()({
  escalated_to: { select: workflowUserSelect },
});

interface EscalationThresholds {
  level1Hours: number;
  level2Hours: number;
  level3Hours: number;
  level4Hours: number;
}

const DEFAULT_THRESHOLDS: EscalationThresholds = {
  level1Hours: 24,
  level2Hours: 72,
  level3Hours: 120,
  level4Hours: 168,
};

interface NotificationTarget {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
}

export class EscalationService implements IEscalationService {
  async checkAndEscalate(): Promise<WorkflowEscalationRunResult> {
    const result: WorkflowEscalationRunResult = {
      checkedEngagements: 0,
      checkedApprovals: 0,
      checkedRequests: 0,
      escalationsFired: 0,
      failures: 0,
    };
    const now = new Date();

    // Preload all active policies once (handful of audit types) instead of
    // re-querying per engagement — avoids an N+1 across the overdue batch.
    const thresholdsByAuditType = await this._loadPolicyThresholds();
    const approvalThresholds = this._resolveThresholds(thresholdsByAuditType, EscalationPolicyAuditType.All);

    const engagements = await prisma.audit_Engagement.findMany({
      where: {
        deleted_at: null,
        status: { notIn: ['reported', 'closed'] },
        sla_deadline: { lt: now },
      },
      select: {
        id: true,
        audit_type: true,
        sla_deadline: true,
      },
    });
    result.checkedEngagements = engagements.length;

    // One query for the latest escalation of every engagement in the batch,
    // instead of one findFirst per engagement.
    const engagementLatest = await this._latestEscalationMap(
      WorkflowEscalationEntityType.AuditEngagement,
      engagements.map((engagement) => engagement.id),
    );

    for (const engagement of engagements) {
      try {
        const latest = engagementLatest.get(engagement.id) ?? null;
        const level = latest ? latest.escalation_level + 1 : 1;
        if (level > 4) continue;

        const thresholds = this._resolveThresholds(
          thresholdsByAuditType,
          engagement.audit_type as EscalationPolicyAuditType,
        );
        const basis = latest?.notified_at ?? engagement.sla_deadline;
        if (!hasElapsed(basis, this._thresholdForLevel(thresholds, level), now)) continue;

        const fired = await this._fireEscalation(
          WorkflowEscalationEntityType.AuditEngagement,
          engagement.id,
          level,
          WorkflowEscalationReason.SlaBreach,
        );
        result.escalationsFired += fired;
      } catch (err) {
        result.failures += 1;
        logger.error('Workflow engagement escalation failed', { err, engagementId: engagement.id });
      }
    }

    const approvals = await prisma.workflow_Approval.findMany({
      where: { status: WorkflowApprovalStatus.Pending },
      select: { id: true, created_at: true },
    });
    result.checkedApprovals = approvals.length;
    const approvalLatest = await this._latestEscalationMap(
      WorkflowEscalationEntityType.WorkflowApproval,
      approvals.map((approval) => approval.id),
    );

    for (const approval of approvals) {
      try {
        const latest = approvalLatest.get(approval.id) ?? null;
        const level = latest ? latest.escalation_level + 1 : 1;
        if (level > 4) continue;

        const basis = latest?.notified_at ?? approval.created_at;
        if (!hasElapsed(basis, this._thresholdForLevel(approvalThresholds, level), now)) continue;

        const fired = await this._fireEscalation(
          WorkflowEscalationEntityType.WorkflowApproval,
          approval.id,
          level,
          WorkflowEscalationReason.ApprovalInaction,
        );
        result.escalationsFired += fired;
      } catch (err) {
        result.failures += 1;
        logger.error('Workflow approval escalation failed', { err, approvalId: approval.id });
      }
    }

    // Ad-hoc requests: remind the current recipient (L1), then notify the
    // initiator (L2). No role chain beyond that since recipients are user-picked.
    const pendingRequests = await prisma.workflow_Request.findMany({
      where: { status: 'pending', deleted_at: null },
      select: { id: true, created_at: true },
    });
    result.checkedRequests = pendingRequests.length;
    const requestLatest = await this._latestEscalationMap(
      WorkflowEscalationEntityType.WorkflowRequest,
      pendingRequests.map((request) => request.id),
    );

    for (const request of pendingRequests) {
      try {
        const latest = requestLatest.get(request.id) ?? null;
        const level = latest ? latest.escalation_level + 1 : 1;
        if (level > 2) continue;

        const basis = latest?.notified_at ?? request.created_at;
        if (!hasElapsed(basis, this._thresholdForLevel(approvalThresholds, level), now)) continue;

        const fired = await this._fireEscalation(
          WorkflowEscalationEntityType.WorkflowRequest,
          request.id,
          level,
          WorkflowEscalationReason.ApprovalInaction,
        );
        result.escalationsFired += fired;
      } catch (err) {
        result.failures += 1;
        logger.error('Workflow request escalation failed', { err, requestId: request.id });
      }
    }

    logger.info('Workflow escalation check completed', result);
    return result;
  }

  async acknowledgeEscalation(escalationId: string, userId: string): Promise<EscalationResponseDto> {
    const escalation = await prisma.workflow_Escalation.findUnique({
      where: { id: escalationId },
      select: { id: true, escalated_to_id: true },
    });
    if (!escalation) throw AppError.notFound('Workflow escalation');
    if (escalation.escalated_to_id !== userId) {
      throw AppError.forbidden('Only the notified user can acknowledge this escalation');
    }

    const updated = await prisma.workflow_Escalation.update({
      where: { id: escalationId },
      data: { acknowledged_at: new Date() },
      include: escalationInclude,
    });

    logger.info('Workflow escalation acknowledged', { escalationId, userId });
    auditLogService.logAsync({
      userId,
      action: 'workflow.escalation.acknowledge',
      module: 'workflow',
      entityType: updated.entity_type,
      entityId: updated.entity_id,
      newValues: { escalationId },
    });

    return mapEscalationToResponse(updated);
  }

  async getEscalationHistory(
    entityType: WorkflowEscalationEntityType,
    entityId: string,
    actor: WorkflowActorContext,
  ): Promise<EscalationResponseDto[]> {
    await this._assertCanViewEscalationHistory(entityType, entityId, actor);
    const escalations = await prisma.workflow_Escalation.findMany({
      where: { entity_type: entityType, entity_id: entityId },
      include: escalationInclude,
      orderBy: { created_at: 'desc' },
    });
    return escalations.map(mapEscalationToResponse);
  }

  async listEscalationPolicies(): Promise<EscalationPolicyResponseDto[]> {
    const policies = await prisma.escalation_Policy.findMany({
      where: { is_active: true },
      orderBy: { audit_type: 'asc' },
    });
    return policies.map(mapEscalationPolicyToResponse);
  }

  async createOrUpdateEscalationPolicy(
    dto: UpsertEscalationPolicyRequestDto,
    updatedBy: WorkflowActorContext,
  ): Promise<EscalationPolicyResponseDto> {
    assertHasPermission(updatedBy.permissions, 'escalation_policy:update');

    const policy = await prisma.escalation_Policy.upsert({
      where: { audit_type: dto.auditType },
      create: {
        audit_type: dto.auditType,
        level_1_hours: dto.level1Hours,
        level_2_hours: dto.level2Hours,
        level_3_hours: dto.level3Hours,
        level_4_hours: dto.level4Hours,
        is_active: dto.isActive,
        created_by_id: updatedBy.id,
      },
      update: {
        level_1_hours: dto.level1Hours,
        level_2_hours: dto.level2Hours,
        level_3_hours: dto.level3Hours,
        level_4_hours: dto.level4Hours,
        is_active: dto.isActive,
      },
    });

    logger.info('Workflow escalation policy upserted', { auditType: dto.auditType, actorId: updatedBy.id });
    auditLogService.logAsync({
      userId: updatedBy.id,
      action: 'workflow.escalation_policy.upsert',
      module: 'workflow',
      entityType: 'escalation_policy',
      entityId: policy.id,
      newValues: dto,
    });

    return mapEscalationPolicyToResponse(policy);
  }

  private async _fireEscalation(
    entityType: WorkflowEscalationEntityType,
    entityId: string,
    level: number,
    reason: WorkflowEscalationReason,
  ): Promise<number> {
    const targets = await this._resolveEscalationTargets(entityType, entityId, level);
    if (targets.length === 0) {
      logger.warn('Workflow escalation skipped: no targets resolved', { entityType, entityId, level });
      return 0;
    }

    const escalations = await prisma.$transaction(targets.map((target) =>
      prisma.workflow_Escalation.create({
        data: {
          entity_type: entityType,
          entity_id: entityId,
          escalation_level: level,
          escalated_to_id: target.id,
          reason,
        },
      }),
    ));

    await Promise.all(targets.map((target) => this._notifyTarget(target, entityType, entityId, level, reason)));

    for (const escalation of escalations) {
      auditLogService.logAsync({
        action: 'workflow.escalation.fire',
        module: 'workflow',
        entityType,
        entityId,
        newValues: {
          escalationId: escalation.id,
          level,
          reason,
          escalatedToId: escalation.escalated_to_id,
        },
      });
    }

    logger.info('Workflow escalation fired', { entityType, entityId, level, reason, targetCount: targets.length });
    return targets.length;
  }

  private async _resolveEscalationTargets(
    entityType: WorkflowEscalationEntityType,
    entityId: string,
    level: number,
  ): Promise<NotificationTarget[]> {
    const targetSelect = {
      id: true,
      email: true,
      display_name: true,
      first_name: true,
      last_name: true,
    } as const;

    const matrix = await getEscalationMatrix();

    if (entityType === WorkflowEscalationEntityType.AuditEngagement) {
      const engagement = await prisma.audit_Engagement.findFirst({
        where: { id: entityId, deleted_at: null },
        select: {
          lead_auditor: { select: targetSelect },
          audit_manager: { select: targetSelect },
        },
      });
      if (!engagement) throw AppError.notFound('Audit engagement');
      if (level === 1) return [engagement.lead_auditor];
      if (level === 2) return [engagement.audit_manager];
      if (level === 3) return this._getUsersByRoles(matrix.auditEngagement.level3);
      return this._getUsersByRoles(matrix.auditEngagement.beyond);
    }

    if (entityType === WorkflowEscalationEntityType.WorkflowRequest) {
      const request = await prisma.workflow_Request.findFirst({
        where: { id: entityId, deleted_at: null },
        select: {
          initiator: { select: targetSelect },
          current_level: true,
          steps: { select: { level: true, recipient: { select: targetSelect } } },
        },
      });
      if (!request) throw AppError.notFound('Workflow request');
      if (level === 1) {
        const currentStep = request.steps.find((step) => step.level === request.current_level);
        return currentStep ? [currentStep.recipient] : [];
      }
      return [request.initiator];
    }

    const approval = await prisma.workflow_Approval.findUnique({
      where: { id: entityId },
      select: {
        current_level: true,
        steps: {
          where: { status: WorkflowApprovalStepStatus.Pending },
          select: {
            level: true,
            required_permission: true,
            approver: { select: targetSelect },
          },
        },
      },
    });
    if (!approval) throw AppError.notFound('Workflow approval');
    if (level === 1) {
      const currentStep = approval.steps.find((step) => step.level === approval.current_level);
      if (!currentStep) return [];
      // Pinned step: that approver. Pool step (no pinned approver): the whole
      // permission pool, so a stuck approval nudges everyone who can act.
      if (currentStep.approver) return [currentStep.approver];
      if (currentStep.required_permission) return this._getUsersByPermission(currentStep.required_permission);
      return [];
    }
    if (level === 3) return this._getUsersByRoles(matrix.workflowApproval.level3);
    if (level === 4) return this._getUsersByRoles(matrix.workflowApproval.level4);
    return this._getUsersByRoles(matrix.workflowApproval.otherwise);
  }
  private async _assertCanViewEscalationHistory(
    entityType: WorkflowEscalationEntityType,
    entityId: string,
    actor: WorkflowActorContext,
  ): Promise<void> {
    if (actor.permissions.includes('engagement:read_all')) return;

    const targeted = await prisma.workflow_Escalation.count({
      where: { entity_type: entityType, entity_id: entityId, escalated_to_id: actor.id },
    });
    if (targeted > 0) return;

    if (entityType === WorkflowEscalationEntityType.AuditEngagement) {
      const count = await prisma.audit_Engagement.count({
        where: {
          id: entityId,
          deleted_at: null,
          OR: [
            { lead_auditor_id: actor.id },
            { audit_manager_id: actor.id },
            { workflow_assignments: { some: { user_id: actor.id } } },
          ],
        },
      });
      if (count > 0) return;
    }

    if (entityType === WorkflowEscalationEntityType.WorkflowApproval) {
      const count = await prisma.workflow_Approval.count({
        where: {
          id: entityId,
          OR: [
            { submitted_by_id: actor.id },
            { steps: { some: { approver_id: actor.id } } },
            { steps: { some: { approver_id: null, required_permission: { in: actor.permissions } } } },
          ],
        },
      });
      if (count > 0) return;
    }

    if (entityType === WorkflowEscalationEntityType.WorkflowRequest) {
      const count = await prisma.workflow_Request.count({
        where: {
          id: entityId,
          deleted_at: null,
          OR: [
            { initiator_id: actor.id },
            { steps: { some: { recipient_id: actor.id } } },
          ],
        },
      });
      if (count > 0) return;
    }

    throw AppError.forbidden('You do not have access to these escalations');
  }

  private async _getUsersByRoles(roleNames: string[]): Promise<NotificationTarget[]> {
    if (roleNames.length === 0) return [];
    return prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        user_roles: { some: { role: { name: { in: roleNames } } } },
      },
      select: {
        id: true,
        email: true,
        display_name: true,
        first_name: true,
        last_name: true,
      },
    });
  }

  private async _getUsersByPermission(permissionSlug: string): Promise<NotificationTarget[]> {
    return prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        user_roles: {
          some: { role: { role_permissions: { some: { permission: { slug: permissionSlug } } } } },
        },
      },
      select: {
        id: true,
        email: true,
        display_name: true,
        first_name: true,
        last_name: true,
      },
    });
  }

  // Latest escalation per entity for a whole batch in a single query. Rows are
  // ordered highest-level/most-recent first, so the first row seen per entity
  // wins.
  private async _latestEscalationMap(
    entityType: WorkflowEscalationEntityType,
    entityIds: string[],
  ): Promise<Map<string, { escalation_level: number; notified_at: Date }>> {
    const map = new Map<string, { escalation_level: number; notified_at: Date }>();
    if (entityIds.length === 0) return map;

    const rows = await prisma.workflow_Escalation.findMany({
      where: { entity_type: entityType, entity_id: { in: entityIds } },
      select: { entity_id: true, escalation_level: true, notified_at: true },
      orderBy: [{ escalation_level: 'desc' }, { notified_at: 'desc' }],
    });
    for (const row of rows) {
      if (!map.has(row.entity_id)) {
        map.set(row.entity_id, {
          escalation_level: row.escalation_level,
          notified_at: row.notified_at,
        });
      }
    }
    return map;
  }

  // All active policies loaded once into a map keyed by audit type, so the
  // escalation sweep never re-queries the same policy per entity.
  private async _loadPolicyThresholds(): Promise<Map<string, EscalationThresholds>> {
    const policies = await prisma.escalation_Policy.findMany({
      where: { is_active: true },
    });
    const map = new Map<string, EscalationThresholds>();
    for (const policy of policies) {
      map.set(policy.audit_type, {
        level1Hours: policy.level_1_hours,
        level2Hours: policy.level_2_hours,
        level3Hours: policy.level_3_hours,
        level4Hours: policy.level_4_hours,
      });
    }
    return map;
  }

  private _resolveThresholds(
    byAuditType: Map<string, EscalationThresholds>,
    auditType: EscalationPolicyAuditType,
  ): EscalationThresholds {
    return (
      byAuditType.get(auditType)
      ?? byAuditType.get(EscalationPolicyAuditType.All)
      ?? DEFAULT_THRESHOLDS
    );
  }

  private _thresholdForLevel(thresholds: EscalationThresholds, level: number): number {
    if (level === 1) return thresholds.level1Hours;
    if (level === 2) return thresholds.level2Hours;
    if (level === 3) return thresholds.level3Hours;
    return thresholds.level4Hours;
  }

  private async _notifyTarget(
    target: NotificationTarget,
    entityType: WorkflowEscalationEntityType,
    entityId: string,
    level: number,
    reason: WorkflowEscalationReason,
  ): Promise<void> {
    const title = `Workflow escalation level ${level}`;
    const body = `Escalation level ${level} fired for ${entityType} due to ${reason}.`;
    const recipientName = target.display_name ?? `${target.first_name} ${target.last_name}`.trim();

    let eventKey: string | undefined;
    let variables: Record<string, string> | undefined;

    if (entityType === WorkflowEscalationEntityType.AuditEngagement) {
      const engagement = await prisma.audit_Engagement.findUnique({
        where: { id: entityId },
        select: { title: true, reference_number: true, sla_deadline: true, status: true },
      });
      if (engagement) {
        const now = new Date();
        const daysOverdue = Math.max(
          0,
          Math.ceil((now.getTime() - engagement.sla_deadline.getTime()) / 86_400_000),
        );
        eventKey = `audit.escalation.level_${level}`;
        variables = {
          recipientName,
          engagementTitle: engagement.title,
          engagementReference: engagement.reference_number,
          slaDeadline: engagement.sla_deadline.toISOString(),
          currentStatus: engagement.status,
          daysOverdue: String(daysOverdue),
        };
      }
    }

    // Runs inside the escalation batch — one bad recipient must not abort the
    // rest, so enqueueSafe swallows and logs.
    await notificationQueueService.enqueueSafe(
      'in_app',
      {
        userId: target.id,
        title,
        body,
        type: 'warning',
        referenceType: entityType,
        referenceId: entityId,
        eventKey,
        variables,
      },
    );

    await notificationQueueService.enqueueSafe(
      'email',
      {
        to: target.email,
        subject: title,
        text: body,
        eventKey,
        variables,
      },
    );
  }
}

export const workflowEscalationService = new EscalationService();
