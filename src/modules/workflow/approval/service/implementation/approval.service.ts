import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  PaginationQuery,
  buildPaginationMeta,
  parsePagination,
} from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import {
  AuditApprovalEntityType,
  IApprovalStatusService,
} from '../../../../audit/approval-status/service/interface/approval-status.service.interface';
import { approvalStatusService as defaultApprovalStatusService } from '../../../../audit/approval-status/service/implementation/approval-status.service';
import { getApprovalMatrix } from '../../../../audit/utility/audit-config.utility';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import {
  WorkflowApprovalStatus,
  WorkflowApprovalStepStatus,
  WorkflowEntityType,
} from '../../../domain/enum/workflow.enum';
import { assertHasPermission } from '../../../utility/workflow.utility';
import { CreateApprovalRequestDto } from '../../dto/request/approval.request.dto';
import { ApprovalResponseDto, mapApprovalToResponse } from '../../dto/response/approval.response.dto';
import { IApprovalService } from '../interface/approval.service.interface';

const workflowUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  display_name: true,
  first_name: true,
  last_name: true,
  department: true,
  job_title: true,
});

const approvalInclude = Prisma.validator<Prisma.Workflow_ApprovalInclude>()({
  submitted_by: { select: workflowUserSelect },
  steps: {
    include: { approver: { select: workflowUserSelect } },
    orderBy: { level: 'asc' },
  },
});

type ApprovalWithDetails = Prisma.Workflow_ApprovalGetPayload<{ include: typeof approvalInclude }>;

interface NotificationTarget {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
}

interface ApprovalNotificationContext {
  eventKey?: string;
  variables?: Record<string, string>;
}

export class ApprovalService implements IApprovalService {
  constructor(private readonly approvalStatusService: IApprovalStatusService = defaultApprovalStatusService) {}

  async createApproval(
    dto: CreateApprovalRequestDto,
    submittedBy: WorkflowActorContext,
    tx?: Prisma.TransactionClient,
  ): Promise<ApprovalResponseDto> {
    const db = tx ?? prisma;
    const existing = await db.workflow_Approval.findFirst({
      where: {
        entity_type: dto.entityType,
        entity_id: dto.entityId,
        status: WorkflowApprovalStatus.Pending,
      },
      select: { id: true },
    });
    if (existing) throw AppError.conflict('A pending approval already exists for this entity');

    const approverIds = await this._resolveApproverChain(db, dto.entityType, dto.entityId);
    if (approverIds.length === 0) throw AppError.badRequest('No approvers configured for this approval');

    const createApprovalRecord = async (client: Prisma.TransactionClient) => {
      const created = await client.workflow_Approval.create({
        data: {
          entity_type: dto.entityType,
          entity_id: dto.entityId,
          submitted_by_id: submittedBy.id,
          current_level: 1,
        },
      });

      await client.workflow_Approval_Step.createMany({
        data: approverIds.map((approverId, index) => ({
          approval_id: created.id,
          level: index + 1,
          approver_id: approverId,
        })),
      });

      return client.workflow_Approval.findUniqueOrThrow({
        where: { id: created.id },
        include: approvalInclude,
      });
    };

    const approval = tx
      ? await createApprovalRecord(tx)
      : await prisma.$transaction(createApprovalRecord, { timeout: 15000 });

    if (!tx) this.queueApprovalRequiredNotification(mapApprovalToResponse(approval));

    logger.info('Workflow approval created', {
      approvalId: approval.id,
      entityType: dto.entityType,
      entityId: dto.entityId,
      actorId: submittedBy.id,
    });
    auditLogService.logAsync({
      userId: submittedBy.id,
      action: 'workflow.approval.create',
      module: 'workflow',
      entityType: dto.entityType,
      entityId: dto.entityId,
      newValues: { approvalId: approval.id, approverIds },
    });

    return mapApprovalToResponse(approval);
  }

  queueApprovalRequiredNotification(approval: ApprovalResponseDto): void {
    const currentStep = approval.steps?.find((step) => step.level === approval.currentLevel);
    if (!currentStep) return;

    void this._queueApprovalCreatedAsync(approval, currentStep.approverId);
  }

  private async _queueApprovalCreatedAsync(
    approval: ApprovalResponseDto,
    approverId: string,
  ): Promise<void> {
    const [entityReference, submitterName] = await Promise.all([
      this._resolveEntityReference(approval.entityType, approval.entityId),
      this._resolveActorName(approval.submittedById),
    ]);

    this._queueNotification(
      approverId,
      {
        title: 'Approval required',
        body: `A ${approval.entityType} requires your approval.`,
        type: 'info',
        referenceType: 'workflow_approval',
        referenceId: approval.id,
      },
      {
        eventKey: 'workflow.approval.created',
        variables: {
          entityType: approval.entityType,
          entityReference,
          submitterName,
          submittedAt: approval.createdAt,
        },
      },
    );
  }

  private async _queueApprovalApprovedAsync(
    approval: ApprovalWithDetails,
    approverId: string,
    comment: string | undefined,
  ): Promise<void> {
    const [entityReference, submitterName, approverName] = await Promise.all([
      this._resolveEntityReference(approval.entity_type, approval.entity_id),
      this._resolveActorName(approval.submitted_by_id),
      this._resolveActorName(approverId),
    ]);

    this._queueNotification(
      approval.submitted_by_id,
      {
        title: 'Approval completed',
        body: `Your ${approval.entity_type} has been approved.`,
        type: 'success',
        referenceType: approval.entity_type,
        referenceId: approval.entity_id,
      },
      {
        eventKey: 'workflow.approval.approved',
        variables: {
          entityType: approval.entity_type,
          entityReference,
          submitterName,
          approverName,
          comment: comment ?? '',
        },
      },
    );
  }

  private async _queueApprovalRejectedAsync(
    approval: ApprovalWithDetails,
    approverId: string,
    reason: string,
  ): Promise<void> {
    const [entityReference, submitterName, approverName] = await Promise.all([
      this._resolveEntityReference(approval.entity_type, approval.entity_id),
      this._resolveActorName(approval.submitted_by_id),
      this._resolveActorName(approverId),
    ]);

    this._queueNotification(
      approval.submitted_by_id,
      {
        title: 'Approval rejected',
        body: `Your ${approval.entity_type} was rejected: ${reason}`,
        type: 'warning',
        referenceType: approval.entity_type,
        referenceId: approval.entity_id,
      },
      {
        eventKey: 'workflow.approval.rejected',
        variables: {
          entityType: approval.entity_type,
          entityReference,
          submitterName,
          approverName,
          rejectionReason: reason,
        },
      },
    );
  }

  async approve(approvalId: string, approverId: string, comment?: string): Promise<ApprovalResponseDto> {
    const approval = await this._getPendingApproval(approvalId);
    const currentStep = this._getCurrentStepForApprover(approval, approverId);
    const nextStep = approval.steps.find((step) => step.level === approval.current_level + 1);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workflow_Approval_Step.update({
        where: { id: currentStep.id },
        data: {
          status: WorkflowApprovalStepStatus.Approved,
          comment: comment ?? null,
          acted_at: now,
        },
      });

      if (nextStep) {
        await tx.workflow_Approval.update({
          where: { id: approvalId },
          data: { current_level: nextStep.level },
        });
      } else {
        await tx.workflow_Approval.update({
          where: { id: approvalId },
          data: {
            status: WorkflowApprovalStatus.Approved,
            completed_at: now,
          },
        });
        await this.approvalStatusService.markApproved(
          tx,
          approval.entity_type as AuditApprovalEntityType,
          approval.entity_id,
          approverId,
          now,
        );
      }

      return tx.workflow_Approval.findUniqueOrThrow({
        where: { id: approvalId },
        include: approvalInclude,
      });
    }, { timeout: 15000 });

    if (nextStep) {
      void this._queueApprovalCreatedAsync(mapApprovalToResponse(updated), nextStep.approver_id);
    } else {
      void this._queueApprovalApprovedAsync(approval, approverId, comment);
    }

    logger.info('Workflow approval step approved', { approvalId, approverId });
    auditLogService.logAsync({
      userId: approverId,
      action: 'workflow.approval.approve',
      module: 'workflow',
      entityType: approval.entity_type,
      entityId: approval.entity_id,
      newValues: { approvalId, comment },
    });

    return mapApprovalToResponse(updated);
  }

  async reject(approvalId: string, approverId: string, reason: string): Promise<ApprovalResponseDto> {
    const approval = await this._getPendingApproval(approvalId);
    const currentStep = this._getCurrentStepForApprover(approval, approverId);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workflow_Approval_Step.update({
        where: { id: currentStep.id },
        data: {
          status: WorkflowApprovalStepStatus.Rejected,
          comment: reason,
          acted_at: now,
        },
      });

      await tx.workflow_Approval.update({
        where: { id: approvalId },
        data: {
          status: WorkflowApprovalStatus.Rejected,
          rejection_reason: reason,
          completed_at: now,
        },
      });

      await this.approvalStatusService.markRejected(
        tx,
        approval.entity_type as AuditApprovalEntityType,
        approval.entity_id,
        approverId,
        reason,
      );

      return tx.workflow_Approval.findUniqueOrThrow({
        where: { id: approvalId },
        include: approvalInclude,
      });
    }, { timeout: 15000 });

    void this._queueApprovalRejectedAsync(approval, approverId, reason);

    logger.info('Workflow approval rejected', { approvalId, approverId });
    auditLogService.logAsync({
      userId: approverId,
      action: 'workflow.approval.reject',
      module: 'workflow',
      entityType: approval.entity_type,
      entityId: approval.entity_id,
      newValues: { approvalId, reason },
    });

    return mapApprovalToResponse(updated);
  }

  async getApprovalById(approvalId: string): Promise<ApprovalResponseDto> {
    const approval = await prisma.workflow_Approval.findUnique({
      where: { id: approvalId },
      include: approvalInclude,
    });
    if (!approval) throw AppError.notFound('Workflow approval');
    return mapApprovalToResponse(approval);
  }

  async getApprovalByEntity(entityType: WorkflowEntityType, entityId: string): Promise<ApprovalResponseDto> {
    const approval = await prisma.workflow_Approval.findFirst({
      where: { entity_type: entityType, entity_id: entityId },
      include: approvalInclude,
      orderBy: { created_at: 'desc' },
    });
    if (!approval) throw AppError.notFound('Workflow approval');
    return mapApprovalToResponse(approval);
  }

  async getPendingApprovalsForUser(
    userId: string,
    pagination: PaginationQuery,
  ): Promise<{ approvals: ApprovalResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(pagination);
    const candidateSteps = await prisma.workflow_Approval_Step.findMany({
      where: {
        approver_id: userId,
        status: WorkflowApprovalStepStatus.Pending,
        approval: { status: WorkflowApprovalStatus.Pending },
      },
      include: { approval: { include: approvalInclude } },
      orderBy: { created_at: 'asc' },
    });

    const approvals = candidateSteps
      .filter((step) => step.level === step.approval.current_level)
      .map((step) => step.approval);
    const paged = approvals.slice(skip, skip + take);

    return {
      approvals: paged.map(mapApprovalToResponse),
      meta: buildPaginationMeta(approvals.length, page, pageSize),
    };
  }

  async cancelApproval(approvalId: string, cancelledBy: WorkflowActorContext): Promise<ApprovalResponseDto> {
    assertHasPermission(cancelledBy.permissions, 'approval:cancel');
    const approval = await this._getPendingApproval(approvalId);

    const updated = await prisma.workflow_Approval.update({
      where: { id: approvalId },
      data: {
        status: WorkflowApprovalStatus.Cancelled,
        completed_at: new Date(),
      },
      include: approvalInclude,
    });

    const approverIds = [...new Set(approval.steps.map((step) => step.approver_id))];
    approverIds.forEach((approverId) =>
      this._queueNotification(approverId, {
        title: 'Approval cancelled',
        body: `The ${approval.entity_type} approval request has been cancelled.`,
        type: 'warning',
        referenceType: 'workflow_approval',
        referenceId: approvalId,
      }),
    );

    logger.info('Workflow approval cancelled', { approvalId, actorId: cancelledBy.id });
    auditLogService.logAsync({
      userId: cancelledBy.id,
      action: 'workflow.approval.cancel',
      module: 'workflow',
      entityType: approval.entity_type,
      entityId: approval.entity_id,
      newValues: { approvalId },
    });

    return mapApprovalToResponse(updated);
  }

  private async _resolveApproverChain(
    db: Prisma.TransactionClient | typeof prisma,
    entityType: WorkflowEntityType,
    entityId: string,
  ): Promise<string[]> {
    const matrix = await getApprovalMatrix();

    // Resolve the engagement's assigned manager for engagement-bound entities so
    // the manager who owns the engagement reviews its working paper / report,
    // rather than just any holder of the manager role.
    let engagementManagerId: string | null = null;
    let roleSequence: string[] | undefined;

    if (entityType === WorkflowEntityType.AuditWorkingPaper) {
      const paper = await db.audit_Working_Paper.findFirst({
        where: { id: entityId, deleted_at: null },
        select: { engagement: { select: { audit_manager_id: true } } },
      });
      if (!paper) throw AppError.notFound('Audit working paper');
      engagementManagerId = paper.engagement.audit_manager_id;
      roleSequence = matrix.workingPaper;
    } else if (entityType === WorkflowEntityType.AuditReport) {
      const report = await db.audit_Report.findFirst({
        where: { id: entityId, deleted_at: null },
        select: { engagement: { select: { audit_manager_id: true } } },
      });
      if (!report) throw AppError.notFound('Audit report');
      engagementManagerId = report.engagement.audit_manager_id;
      roleSequence = matrix.auditReport;
    } else if (entityType === WorkflowEntityType.AuditPlan) {
      const plan = await db.audit_Plan.findFirst({ where: { id: entityId, deleted_at: null }, select: { id: true } });
      if (!plan) throw AppError.notFound('Audit plan');
      roleSequence = matrix.auditPlan;
    }

    // Unknown entity type or empty matrix entry: fall back to the first active CAE.
    if (!roleSequence || roleSequence.length === 0) {
      const fallback = await this._getFirstActiveUserByRole(db, 'cae');
      return fallback ? [fallback] : [];
    }

    const chain: string[] = [];
    for (let level = 0; level < roleSequence.length; level += 1) {
      // For engagement-bound entities the first approver is the engagement's
      // assigned manager (a specific person), not just any holder of the role.
      if (level === 0 && engagementManagerId) {
        chain.push(engagementManagerId);
        continue;
      }
      const userId = await this._getFirstActiveUserByRole(db, roleSequence[level]);
      if (!userId) {
        throw AppError.badRequest(`No active user with role '${roleSequence[level]}' configured for ${entityType} approval`);
      }
      chain.push(userId);
    }
    return chain;
  }

  private async _getFirstActiveUserByRole(
    db: Prisma.TransactionClient | typeof prisma,
    roleName: string,
  ): Promise<string | null> {
    const user = await db.user.findFirst({
      where: {
        deleted_at: null,
        is_active: true,
        user_roles: { some: { role: { name: roleName } } },
      },
      select: { id: true },
      orderBy: { created_at: 'asc' },
    });
    return user?.id ?? null;
  }

  private async _getPendingApproval(approvalId: string): Promise<ApprovalWithDetails> {
    const approval = await prisma.workflow_Approval.findUnique({
      where: { id: approvalId },
      include: approvalInclude,
    });
    if (!approval) throw AppError.notFound('Workflow approval');
    if (approval.status !== WorkflowApprovalStatus.Pending) {
      throw AppError.badRequest('Only pending approvals can be acted on');
    }
    return approval;
  }

  private _getCurrentStepForApprover(approval: ApprovalWithDetails, approverId: string): ApprovalWithDetails['steps'][number] {
    const step = approval.steps.find((item) => item.level === approval.current_level);
    if (!step) throw AppError.badRequest('Approval has no pending current step');
    if (step.approver_id !== approverId) {
      throw AppError.forbidden('You are not the approver for the current approval step');
    }
    if (step.status !== WorkflowApprovalStepStatus.Pending) {
      throw AppError.badRequest('Current approval step has already been actioned');
    }
    return step;
  }

  private async _notifyUser(
    userId: string,
    notification: {
      title: string;
      body: string;
      type: 'info' | 'warning' | 'error' | 'success';
      referenceType: string;
      referenceId: string;
    },
    context: ApprovalNotificationContext = {},
  ): Promise<void> {
    const user: NotificationTarget | null = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null, is_active: true },
      select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
    });
    if (!user) return;

    const recipientName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
    const variables = context.variables
      ? { recipientName, ...context.variables }
      : undefined;

    await notificationQueueService.enqueue(
      'in_app',
      {
        userId: user.id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        referenceType: notification.referenceType,
        referenceId: notification.referenceId,
        eventKey: context.eventKey,
        variables,
      },
    );

    await notificationQueueService.enqueue(
      'email',
      {
        to: user.email,
        subject: notification.title,
        text: notification.body,
        eventKey: context.eventKey,
        variables,
      },
    );
  }

  private _queueNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      type: 'info' | 'warning' | 'error' | 'success';
      referenceType: string;
      referenceId: string;
    },
    context: ApprovalNotificationContext = {},
  ): void {
    void this._notifyUser(userId, notification, context).catch((err: unknown) => {
      logger.warn('Workflow approval notification failed', { err, userId });
    });
  }

  private async _resolveEntityReference(
    entityType: string,
    entityId: string,
  ): Promise<string> {
    if (entityType === WorkflowEntityType.AuditReport) {
      const report = await prisma.audit_Report.findUnique({
        where: { id: entityId },
        select: { title: true, engagement: { select: { reference_number: true } } },
      });
      return report?.engagement.reference_number ?? entityId;
    }
    if (entityType === WorkflowEntityType.AuditWorkingPaper) {
      const wp = await prisma.audit_Working_Paper.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      return wp?.title ?? entityId;
    }
    if (entityType === WorkflowEntityType.AuditPlan) {
      const plan = await prisma.audit_Plan.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      return plan?.title ?? entityId;
    }
    return entityId;
  }

  private async _resolveActorName(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { display_name: true, first_name: true, last_name: true },
    });
    if (!user) return '';
    return user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
  }
}

export const workflowApprovalService = new ApprovalService();
