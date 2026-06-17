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
import { ApprovalMatrix, ENGAGEMENT_MANAGER_APPROVER, getApprovalMatrix } from '../../../../audit/utility/audit-config.utility';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import {
  WorkflowApprovalStatus,
  WorkflowApprovalStepStatus,
  WorkflowEntityType,
} from '../../../domain/enum/workflow.enum';
import { assertHasPermission } from '../../../utility/workflow.utility';
import { CreateApprovalRequestDto } from '../../dto/request/approval.request.dto';
import {
  ApprovalResponseDto,
  SignedApprovalDocumentDto,
  mapApprovalToResponse,
} from '../../dto/response/approval.response.dto';
import { ApprovalActor, IApprovalService } from '../interface/approval.service.interface';
import { userSignatureService } from '../../../../user/service/implementation/signature.service';

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

/** A resolved approval level: either pinned to one user or open to any permission holder. */
interface ApproverLevelSpec {
  approverId: string | null;
  requiredPermission: string;
}

/** Just enough of a step to work out who should be notified / who may act. */
interface StepRecipientSpec {
  approverId: string | null;
  requiredPermission: string | null;
}

/** Capability permission a user must hold to act as an engagement's manager-level approver. */
const ENGAGEMENT_MANAGER_PERMISSION: Partial<Record<WorkflowEntityType, string>> = {
  [WorkflowEntityType.AuditWorkingPaper]: 'working_paper:approve',
  [WorkflowEntityType.AuditReport]: 'report:approve',
  [WorkflowEntityType.AuditFindingClosure]: 'finding:close',
};

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

    const levels = await this._resolveApproverChain(db, dto.entityType, dto.entityId);
    if (levels.length === 0) throw AppError.badRequest('No approvers configured for this approval');

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
        data: levels.map((spec, index) => ({
          approval_id: created.id,
          level: index + 1,
          approver_id: spec.approverId,
          required_permission: spec.requiredPermission,
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
      newValues: { approvalId: approval.id, levels },
    });

    return mapApprovalToResponse(approval);
  }

  queueApprovalRequiredNotification(approval: ApprovalResponseDto): void {
    const currentStep = approval.steps?.find((step) => step.level === approval.currentLevel);
    if (!currentStep) return;

    void this._queueApprovalCreatedAsync(approval, {
      approverId: currentStep.approverId,
      requiredPermission: currentStep.requiredPermission,
    });
  }

  private async _queueApprovalCreatedAsync(
    approval: ApprovalResponseDto,
    step: StepRecipientSpec,
  ): Promise<void> {
    const recipientIds = await this._stepRecipientIds(step);
    if (recipientIds.length === 0) return;

    const [entityReference, submitterName] = await Promise.all([
      this._resolveEntityReference(approval.entityType, approval.entityId),
      this._resolveActorName(approval.submittedById),
    ]);

    for (const recipientId of recipientIds) {
      this._queueNotification(
        recipientId,
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

  async approve(approvalId: string, actor: ApprovalActor, comment?: string): Promise<ApprovalResponseDto> {
    const approval = await this._getPendingApproval(approvalId);
    const currentStep = this._getActionableStep(approval, actor);
    const nextStep = approval.steps.find((step) => step.level === approval.current_level + 1);
    const now = new Date();

    // Approve & Sign: record the approver's active signature on the step (null if none).
    const sigRef = await userSignatureService.getActiveSignatureRef(actor.id);

    const updated = await prisma.$transaction(async (tx) => {
      // Atomically claim the step: only succeeds while it is still pending, so two
      // concurrent approvers can't both act — the loser matches 0 rows and aborts.
      const claimed = await tx.workflow_Approval_Step.updateMany({
        where: { id: currentStep.id, status: WorkflowApprovalStepStatus.Pending },
        data: {
          status: WorkflowApprovalStepStatus.Approved,
          approver_id: actor.id,
          comment: comment ?? null,
          acted_at: now,
          signature_id: sigRef?.id ?? null,
        },
      });
      if (claimed.count === 0) {
        throw AppError.conflict('This approval step has already been actioned');
      }

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
          actor.id,
          now,
        );
      }

      return tx.workflow_Approval.findUniqueOrThrow({
        where: { id: approvalId },
        include: approvalInclude,
      });
    }, { timeout: 15000 });

    if (nextStep) {
      void this._queueApprovalCreatedAsync(mapApprovalToResponse(updated), {
        approverId: nextStep.approver_id,
        requiredPermission: nextStep.required_permission,
      });
    } else {
      void this._queueApprovalApprovedAsync(approval, actor.id, comment);
      // Freeze the signed artifact once, post-commit. Dynamic import avoids the
      // audit↔workflow module cycle (the audit generator imports this service);
      // it resolves fine at runtime, long after startup. Fire-and-forget.
      void import('../../../../audit/approval-signature/service/implementation/approval-signed-document.service')
        .then((m) => m.approvalSignedDocumentService.generateForCompletedApproval(approvalId))
        .catch((err: unknown) => logger.warn('Approval freeze enqueue failed', { approvalId, err }));
    }

    logger.info('Workflow approval step approved', { approvalId, approverId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'workflow.approval.approve',
      module: 'workflow',
      entityType: approval.entity_type,
      entityId: approval.entity_id,
      newValues: { approvalId, comment },
    });

    return mapApprovalToResponse(updated);
  }

  async reject(approvalId: string, actor: ApprovalActor, reason: string): Promise<ApprovalResponseDto> {
    const approval = await this._getPendingApproval(approvalId);
    const currentStep = this._getActionableStep(approval, actor);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      // Atomically claim the step (see approve): the loser of a concurrent
      // approve/reject on the same step matches 0 rows and aborts.
      const claimed = await tx.workflow_Approval_Step.updateMany({
        where: { id: currentStep.id, status: WorkflowApprovalStepStatus.Pending },
        data: {
          status: WorkflowApprovalStepStatus.Rejected,
          approver_id: actor.id,
          comment: reason,
          acted_at: now,
        },
      });
      if (claimed.count === 0) {
        throw AppError.conflict('This approval step has already been actioned');
      }

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
        actor.id,
        reason,
      );

      return tx.workflow_Approval.findUniqueOrThrow({
        where: { id: approvalId },
        include: approvalInclude,
      });
    }, { timeout: 15000 });

    void this._queueApprovalRejectedAsync(approval, actor.id, reason);

    logger.info('Workflow approval rejected', { approvalId, approverId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
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
    actor: ApprovalActor,
    pagination: PaginationQuery,
  ): Promise<{ approvals: ApprovalResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(pagination);

    // A user sees a step if it is pinned to them, or it is an open permission-pool
    // step whose required permission they hold.
    const orConditions: Prisma.Workflow_Approval_StepWhereInput[] = [{ approver_id: actor.id }];
    if (actor.permissions.length > 0) {
      orConditions.push({ approver_id: null, required_permission: { in: actor.permissions } });
    }

    const candidateSteps = await prisma.workflow_Approval_Step.findMany({
      where: {
        status: WorkflowApprovalStepStatus.Pending,
        approval: { status: WorkflowApprovalStatus.Pending },
        OR: orConditions,
      },
      include: { approval: { include: approvalInclude } },
      orderBy: { created_at: 'asc' },
    });

    // Only the current-level step is actionable; dedupe to one entry per approval.
    const approvalsById = new Map<string, ApprovalWithDetails>();
    for (const step of candidateSteps) {
      if (step.level === step.approval.current_level) {
        approvalsById.set(step.approval.id, step.approval);
      }
    }
    const approvals = [...approvalsById.values()];
    const paged = approvals.slice(skip, skip + take);

    return {
      approvals: paged.map(mapApprovalToResponse),
      meta: buildPaginationMeta(approvals.length, page, pageSize),
    };
  }

  async listSignedDocuments(approvalId: string): Promise<SignedApprovalDocumentDto[]> {
    const rows = await prisma.workflow_Approval_Signed_Document.findMany({
      where: { approval_id: approvalId },
      orderBy: { generated_at: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      signedDocumentId: r.signed_document_id,
      downloadUrl: `/api/proxy/documents/${r.signed_document_id}/file`,
      generatedAt: r.generated_at.toISOString(),
    }));
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

    const recipientIds = new Set<string>();
    for (const step of approval.steps) {
      const ids = await this._stepRecipientIds({
        approverId: step.approver_id,
        requiredPermission: step.required_permission,
      });
      ids.forEach((id) => recipientIds.add(id));
    }
    recipientIds.forEach((recipientId) =>
      this._queueNotification(recipientId, {
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
  ): Promise<ApproverLevelSpec[]> {
    const matrix = await getApprovalMatrix();
    const chain = this._chainForEntity(matrix, entityType);
    if (chain.length === 0) return [];

    // Engagement-bound entities pin levels marked ENGAGEMENT_MANAGER_APPROVER to
    // the engagement's assigned manager (a specific person), so the manager who
    // owns the engagement reviews its working paper / report.
    const engagementManagerId = await this._resolveEngagementManager(db, entityType, entityId);
    const managerPermission = ENGAGEMENT_MANAGER_PERMISSION[entityType];

    const specs: ApproverLevelSpec[] = [];
    for (const level of chain) {
      if (level === ENGAGEMENT_MANAGER_APPROVER) {
        if (!engagementManagerId) {
          throw AppError.badRequest(`No engagement manager available for ${entityType} approval`);
        }
        if (!managerPermission) {
          throw AppError.badRequest(`No approver permission configured for ${entityType} manager approval`);
        }
        // Pinned to the engagement's manager, who must still hold the permission to act.
        specs.push({ approverId: engagementManagerId, requiredPermission: managerPermission });
        continue;
      }

      // `level` is a permission slug: any active holder may act. Ensure at least
      // one exists so the level can't dead-end.
      const hasHolder = await this._hasActiveUserWithPermission(db, level);
      if (!hasHolder) {
        throw AppError.badRequest(`No active user holding permission '${level}' is available for ${entityType} approval`);
      }
      specs.push({ approverId: null, requiredPermission: level });
    }
    return specs;
  }

  private _chainForEntity(matrix: ApprovalMatrix, entityType: WorkflowEntityType): string[] {
    switch (entityType) {
      case WorkflowEntityType.AuditPlan:
        return matrix.auditPlan;
      case WorkflowEntityType.AuditWorkingPaper:
        return matrix.workingPaper;
      case WorkflowEntityType.AuditReport:
        return matrix.auditReport;
      case WorkflowEntityType.AuditFindingClosure:
        return matrix.findingClosure;
      default:
        return [];
    }
  }

  private async _resolveEngagementManager(
    db: Prisma.TransactionClient | typeof prisma,
    entityType: WorkflowEntityType,
    entityId: string,
  ): Promise<string | null> {
    if (entityType === WorkflowEntityType.AuditWorkingPaper) {
      const paper = await db.audit_Working_Paper.findFirst({
        where: { id: entityId, deleted_at: null },
        select: { engagement: { select: { audit_manager_id: true } } },
      });
      if (!paper) throw AppError.notFound('Audit working paper');
      return paper.engagement.audit_manager_id;
    }
    if (entityType === WorkflowEntityType.AuditReport) {
      const report = await db.audit_Report.findFirst({
        where: { id: entityId, deleted_at: null },
        select: { engagement: { select: { audit_manager_id: true } } },
      });
      if (!report) throw AppError.notFound('Audit report');
      return report.engagement.audit_manager_id;
    }
    if (entityType === WorkflowEntityType.AuditFindingClosure) {
      const finding = await db.audit_Finding.findFirst({
        where: { id: entityId, deleted_at: null },
        select: { engagement: { select: { audit_manager_id: true } } },
      });
      if (!finding) throw AppError.notFound('Audit finding');
      return finding.engagement.audit_manager_id;
    }
    if (entityType === WorkflowEntityType.AuditPlan) {
      const plan = await db.audit_Plan.findFirst({ where: { id: entityId, deleted_at: null }, select: { id: true } });
      if (!plan) throw AppError.notFound('Audit plan');
    }
    return null;
  }

  private async _hasActiveUserWithPermission(
    db: Prisma.TransactionClient | typeof prisma,
    permissionSlug: string,
  ): Promise<boolean> {
    const user = await db.user.findFirst({
      where: this._activeHolderWhere(permissionSlug),
      select: { id: true },
    });
    return user !== null;
  }

  /** All active users who currently hold a permission — the pool that can act on a pool level. */
  private async _stepRecipientIds(step: StepRecipientSpec): Promise<string[]> {
    if (step.approverId) return [step.approverId];
    if (!step.requiredPermission) return [];
    const users = await prisma.user.findMany({
      where: this._activeHolderWhere(step.requiredPermission),
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  private _activeHolderWhere(permissionSlug: string): Prisma.UserWhereInput {
    return {
      deleted_at: null,
      is_active: true,
      user_roles: {
        some: {
          role: { role_permissions: { some: { permission: { slug: permissionSlug } } } },
        },
      },
    };
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

  private _getActionableStep(approval: ApprovalWithDetails, actor: ApprovalActor): ApprovalWithDetails['steps'][number] {
    const step = approval.steps.find((item) => item.level === approval.current_level);
    if (!step) throw AppError.badRequest('Approval has no pending current step');
    if (step.status !== WorkflowApprovalStepStatus.Pending) {
      throw AppError.badRequest('Current approval step has already been actioned');
    }
    // A step always requires its permission. A pinned step additionally requires
    // the actor to be that specific user (the engagement's manager); a pool step
    // is open to any holder of the permission.
    const holdsPermission = !step.required_permission || actor.permissions.includes(step.required_permission);
    const isPinnedApprover = step.approver_id === null || step.approver_id === actor.id;
    if (!holdsPermission || !isPinnedApprover) {
      throw AppError.forbidden('You are not authorized to act on the current approval step');
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
    if (entityType === WorkflowEntityType.AuditFindingClosure) {
      const finding = await prisma.audit_Finding.findUnique({
        where: { id: entityId },
        select: { title: true, engagement: { select: { reference_number: true } } },
      });
      return finding ? `${finding.engagement.reference_number} - ${finding.title}` : entityId;
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
