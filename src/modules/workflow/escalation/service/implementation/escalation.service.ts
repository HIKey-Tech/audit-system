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
import { WORKFLOW_ADMIN_ROLES, assertHasRole, hasElapsed } from '../../../utility/workflow.utility';
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

interface NotificationTarget {
  id: string;
  email: string;
}

export class EscalationService implements IEscalationService {
  async checkAndEscalate(): Promise<WorkflowEscalationRunResult> {
    const result: WorkflowEscalationRunResult = {
      checkedEngagements: 0,
      checkedApprovals: 0,
      escalationsFired: 0,
      failures: 0,
    };
    const now = new Date();

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

    for (const engagement of engagements) {
      try {
        const latest = await this._getLatestEscalation(WorkflowEscalationEntityType.AuditEngagement, engagement.id);
        const level = latest ? latest.escalation_level + 1 : 1;
        if (level > 4) continue;

        const thresholds = await this._getPolicyThresholds(engagement.audit_type as EscalationPolicyAuditType);
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
    const approvalThresholds = await this._getPolicyThresholds(EscalationPolicyAuditType.All);

    for (const approval of approvals) {
      try {
        const latest = await this._getLatestEscalation(WorkflowEscalationEntityType.WorkflowApproval, approval.id);
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
  ): Promise<EscalationResponseDto[]> {
    const escalations = await prisma.workflow_Escalation.findMany({
      where: { entity_type: entityType, entity_id: entityId },
      include: escalationInclude,
      orderBy: { created_at: 'desc' },
    });
    return escalations.map(mapEscalationToResponse);
  }

  async getEscalationPolicy(auditType: EscalationPolicyAuditType): Promise<EscalationPolicyResponseDto> {
    const policy = await prisma.escalation_Policy.findFirst({
      where: { audit_type: auditType, is_active: true },
    }) ?? await prisma.escalation_Policy.findFirst({
      where: { audit_type: EscalationPolicyAuditType.All, is_active: true },
    });
    if (!policy) throw AppError.notFound('Escalation policy');
    return mapEscalationPolicyToResponse(policy);
  }

  async createOrUpdateEscalationPolicy(
    dto: UpsertEscalationPolicyRequestDto,
    updatedBy: WorkflowActorContext,
  ): Promise<EscalationPolicyResponseDto> {
    assertHasRole(updatedBy.roles, WORKFLOW_ADMIN_ROLES);

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
    if (entityType === WorkflowEscalationEntityType.AuditEngagement) {
      const engagement = await prisma.audit_Engagement.findFirst({
        where: { id: entityId, deleted_at: null },
        select: {
          lead_auditor: { select: { id: true, email: true } },
          audit_manager: { select: { id: true, email: true } },
        },
      });
      if (!engagement) throw AppError.notFound('Audit engagement');
      if (level === 1) return [engagement.lead_auditor];
      if (level === 2) return [engagement.audit_manager];
      if (level === 3) return this._getUsersByRole('director');
      return this._getUsersByRole('cae');
    }

    const approval = await prisma.workflow_Approval.findUnique({
      where: { id: entityId },
      select: {
        current_level: true,
        steps: {
          where: { status: WorkflowApprovalStepStatus.Pending },
          select: {
            level: true,
            approver: { select: { id: true, email: true } },
          },
        },
      },
    });
    if (!approval) throw AppError.notFound('Workflow approval');
    if (level === 1) {
      const currentStep = approval.steps.find((step) => step.level === approval.current_level);
      return currentStep ? [currentStep.approver] : [];
    }
    if (level === 3) return this._getUsersByRole('director');
    if (level === 4) return this._getUsersByRole('cae');
    return this._getUsersByRole('audit_admin');
  }

  private async _getUsersByRole(roleName: string): Promise<NotificationTarget[]> {
    return prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        user_roles: { some: { role: { name: roleName } } },
      },
      select: { id: true, email: true },
    });
  }

  private async _getLatestEscalation(
    entityType: WorkflowEscalationEntityType,
    entityId: string,
  ): Promise<{ escalation_level: number; notified_at: Date } | null> {
    return prisma.workflow_Escalation.findFirst({
      where: { entity_type: entityType, entity_id: entityId },
      select: { escalation_level: true, notified_at: true },
      orderBy: [{ escalation_level: 'desc' }, { notified_at: 'desc' }],
    });
  }

  private async _getPolicyThresholds(auditType: EscalationPolicyAuditType): Promise<EscalationThresholds> {
    const policy = await prisma.escalation_Policy.findFirst({
      where: { audit_type: auditType, is_active: true },
    }) ?? await prisma.escalation_Policy.findFirst({
      where: { audit_type: EscalationPolicyAuditType.All, is_active: true },
    });

    if (!policy) {
      return {
        level1Hours: 24,
        level2Hours: 72,
        level3Hours: 120,
        level4Hours: 168,
      };
    }

    return {
      level1Hours: policy.level_1_hours,
      level2Hours: policy.level_2_hours,
      level3Hours: policy.level_3_hours,
      level4Hours: policy.level_4_hours,
    };
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

    await notificationQueueService.enqueue(
      'in_app',
      {
        userId: target.id,
        title,
        body,
        type: 'warning',
        referenceType: entityType,
        referenceId: entityId,
      },
    );

    await notificationQueueService.enqueue(
      'email',
      {
        to: target.email,
        subject: title,
        text: body,
      },
    );
  }
}

export const workflowEscalationService = new EscalationService();
