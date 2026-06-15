"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowApprovalService = exports.ApprovalService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const approval_status_service_1 = require("../../../../audit/approval-status/service/implementation/approval-status.service");
const audit_config_utility_1 = require("../../../../audit/utility/audit-config.utility");
const workflow_enum_1 = require("../../../domain/enum/workflow.enum");
const workflow_utility_1 = require("../../../utility/workflow.utility");
const approval_response_dto_1 = require("../../dto/response/approval.response.dto");
const workflowUserSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
    department: true,
    job_title: true,
});
const approvalInclude = client_1.Prisma.validator()({
    submitted_by: { select: workflowUserSelect },
    steps: {
        include: { approver: { select: workflowUserSelect } },
        orderBy: { level: 'asc' },
    },
});
/** Capability permission a user must hold to act as an engagement's manager-level approver. */
const ENGAGEMENT_MANAGER_PERMISSION = {
    [workflow_enum_1.WorkflowEntityType.AuditWorkingPaper]: 'working_paper:approve',
    [workflow_enum_1.WorkflowEntityType.AuditReport]: 'report:approve',
};
class ApprovalService {
    approvalStatusService;
    constructor(approvalStatusService = approval_status_service_1.approvalStatusService) {
        this.approvalStatusService = approvalStatusService;
    }
    async createApproval(dto, submittedBy, tx) {
        const db = tx ?? prisma_client_1.prisma;
        const existing = await db.workflow_Approval.findFirst({
            where: {
                entity_type: dto.entityType,
                entity_id: dto.entityId,
                status: workflow_enum_1.WorkflowApprovalStatus.Pending,
            },
            select: { id: true },
        });
        if (existing)
            throw app_error_1.AppError.conflict('A pending approval already exists for this entity');
        const levels = await this._resolveApproverChain(db, dto.entityType, dto.entityId);
        if (levels.length === 0)
            throw app_error_1.AppError.badRequest('No approvers configured for this approval');
        const createApprovalRecord = async (client) => {
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
            : await prisma_client_1.prisma.$transaction(createApprovalRecord, { timeout: 15000 });
        if (!tx)
            this.queueApprovalRequiredNotification((0, approval_response_dto_1.mapApprovalToResponse)(approval));
        logger_util_1.logger.info('Workflow approval created', {
            approvalId: approval.id,
            entityType: dto.entityType,
            entityId: dto.entityId,
            actorId: submittedBy.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: submittedBy.id,
            action: 'workflow.approval.create',
            module: 'workflow',
            entityType: dto.entityType,
            entityId: dto.entityId,
            newValues: { approvalId: approval.id, levels },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(approval);
    }
    queueApprovalRequiredNotification(approval) {
        const currentStep = approval.steps?.find((step) => step.level === approval.currentLevel);
        if (!currentStep)
            return;
        void this._queueApprovalCreatedAsync(approval, {
            approverId: currentStep.approverId,
            requiredPermission: currentStep.requiredPermission,
        });
    }
    async _queueApprovalCreatedAsync(approval, step) {
        const recipientIds = await this._stepRecipientIds(step);
        if (recipientIds.length === 0)
            return;
        const [entityReference, submitterName] = await Promise.all([
            this._resolveEntityReference(approval.entityType, approval.entityId),
            this._resolveActorName(approval.submittedById),
        ]);
        for (const recipientId of recipientIds) {
            this._queueNotification(recipientId, {
                title: 'Approval required',
                body: `A ${approval.entityType} requires your approval.`,
                type: 'info',
                referenceType: 'workflow_approval',
                referenceId: approval.id,
            }, {
                eventKey: 'workflow.approval.created',
                variables: {
                    entityType: approval.entityType,
                    entityReference,
                    submitterName,
                    submittedAt: approval.createdAt,
                },
            });
        }
    }
    async _queueApprovalApprovedAsync(approval, approverId, comment) {
        const [entityReference, submitterName, approverName] = await Promise.all([
            this._resolveEntityReference(approval.entity_type, approval.entity_id),
            this._resolveActorName(approval.submitted_by_id),
            this._resolveActorName(approverId),
        ]);
        this._queueNotification(approval.submitted_by_id, {
            title: 'Approval completed',
            body: `Your ${approval.entity_type} has been approved.`,
            type: 'success',
            referenceType: approval.entity_type,
            referenceId: approval.entity_id,
        }, {
            eventKey: 'workflow.approval.approved',
            variables: {
                entityType: approval.entity_type,
                entityReference,
                submitterName,
                approverName,
                comment: comment ?? '',
            },
        });
    }
    async _queueApprovalRejectedAsync(approval, approverId, reason) {
        const [entityReference, submitterName, approverName] = await Promise.all([
            this._resolveEntityReference(approval.entity_type, approval.entity_id),
            this._resolveActorName(approval.submitted_by_id),
            this._resolveActorName(approverId),
        ]);
        this._queueNotification(approval.submitted_by_id, {
            title: 'Approval rejected',
            body: `Your ${approval.entity_type} was rejected: ${reason}`,
            type: 'warning',
            referenceType: approval.entity_type,
            referenceId: approval.entity_id,
        }, {
            eventKey: 'workflow.approval.rejected',
            variables: {
                entityType: approval.entity_type,
                entityReference,
                submitterName,
                approverName,
                rejectionReason: reason,
            },
        });
    }
    async approve(approvalId, actor, comment) {
        const approval = await this._getPendingApproval(approvalId);
        const currentStep = this._getActionableStep(approval, actor);
        const nextStep = approval.steps.find((step) => step.level === approval.current_level + 1);
        const now = new Date();
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            // Atomically claim the step: only succeeds while it is still pending, so two
            // concurrent approvers can't both act — the loser matches 0 rows and aborts.
            const claimed = await tx.workflow_Approval_Step.updateMany({
                where: { id: currentStep.id, status: workflow_enum_1.WorkflowApprovalStepStatus.Pending },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStepStatus.Approved,
                    approver_id: actor.id,
                    comment: comment ?? null,
                    acted_at: now,
                },
            });
            if (claimed.count === 0) {
                throw app_error_1.AppError.conflict('This approval step has already been actioned');
            }
            if (nextStep) {
                await tx.workflow_Approval.update({
                    where: { id: approvalId },
                    data: { current_level: nextStep.level },
                });
            }
            else {
                await tx.workflow_Approval.update({
                    where: { id: approvalId },
                    data: {
                        status: workflow_enum_1.WorkflowApprovalStatus.Approved,
                        completed_at: now,
                    },
                });
                await this.approvalStatusService.markApproved(tx, approval.entity_type, approval.entity_id, actor.id, now);
            }
            return tx.workflow_Approval.findUniqueOrThrow({
                where: { id: approvalId },
                include: approvalInclude,
            });
        }, { timeout: 15000 });
        if (nextStep) {
            void this._queueApprovalCreatedAsync((0, approval_response_dto_1.mapApprovalToResponse)(updated), {
                approverId: nextStep.approver_id,
                requiredPermission: nextStep.required_permission,
            });
        }
        else {
            void this._queueApprovalApprovedAsync(approval, actor.id, comment);
        }
        logger_util_1.logger.info('Workflow approval step approved', { approvalId, approverId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.approval.approve',
            module: 'workflow',
            entityType: approval.entity_type,
            entityId: approval.entity_id,
            newValues: { approvalId, comment },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(updated);
    }
    async reject(approvalId, actor, reason) {
        const approval = await this._getPendingApproval(approvalId);
        const currentStep = this._getActionableStep(approval, actor);
        const now = new Date();
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            // Atomically claim the step (see approve): the loser of a concurrent
            // approve/reject on the same step matches 0 rows and aborts.
            const claimed = await tx.workflow_Approval_Step.updateMany({
                where: { id: currentStep.id, status: workflow_enum_1.WorkflowApprovalStepStatus.Pending },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStepStatus.Rejected,
                    approver_id: actor.id,
                    comment: reason,
                    acted_at: now,
                },
            });
            if (claimed.count === 0) {
                throw app_error_1.AppError.conflict('This approval step has already been actioned');
            }
            await tx.workflow_Approval.update({
                where: { id: approvalId },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStatus.Rejected,
                    rejection_reason: reason,
                    completed_at: now,
                },
            });
            await this.approvalStatusService.markRejected(tx, approval.entity_type, approval.entity_id, actor.id, reason);
            return tx.workflow_Approval.findUniqueOrThrow({
                where: { id: approvalId },
                include: approvalInclude,
            });
        }, { timeout: 15000 });
        void this._queueApprovalRejectedAsync(approval, actor.id, reason);
        logger_util_1.logger.info('Workflow approval rejected', { approvalId, approverId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.approval.reject',
            module: 'workflow',
            entityType: approval.entity_type,
            entityId: approval.entity_id,
            newValues: { approvalId, reason },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(updated);
    }
    async getApprovalById(approvalId) {
        const approval = await prisma_client_1.prisma.workflow_Approval.findUnique({
            where: { id: approvalId },
            include: approvalInclude,
        });
        if (!approval)
            throw app_error_1.AppError.notFound('Workflow approval');
        return (0, approval_response_dto_1.mapApprovalToResponse)(approval);
    }
    async getApprovalByEntity(entityType, entityId) {
        const approval = await prisma_client_1.prisma.workflow_Approval.findFirst({
            where: { entity_type: entityType, entity_id: entityId },
            include: approvalInclude,
            orderBy: { created_at: 'desc' },
        });
        if (!approval)
            throw app_error_1.AppError.notFound('Workflow approval');
        return (0, approval_response_dto_1.mapApprovalToResponse)(approval);
    }
    async getPendingApprovalsForUser(actor, pagination) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(pagination);
        // A user sees a step if it is pinned to them, or it is an open permission-pool
        // step whose required permission they hold.
        const orConditions = [{ approver_id: actor.id }];
        if (actor.permissions.length > 0) {
            orConditions.push({ approver_id: null, required_permission: { in: actor.permissions } });
        }
        const candidateSteps = await prisma_client_1.prisma.workflow_Approval_Step.findMany({
            where: {
                status: workflow_enum_1.WorkflowApprovalStepStatus.Pending,
                approval: { status: workflow_enum_1.WorkflowApprovalStatus.Pending },
                OR: orConditions,
            },
            include: { approval: { include: approvalInclude } },
            orderBy: { created_at: 'asc' },
        });
        // Only the current-level step is actionable; dedupe to one entry per approval.
        const approvalsById = new Map();
        for (const step of candidateSteps) {
            if (step.level === step.approval.current_level) {
                approvalsById.set(step.approval.id, step.approval);
            }
        }
        const approvals = [...approvalsById.values()];
        const paged = approvals.slice(skip, skip + take);
        return {
            approvals: paged.map(approval_response_dto_1.mapApprovalToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(approvals.length, page, pageSize),
        };
    }
    async cancelApproval(approvalId, cancelledBy) {
        (0, workflow_utility_1.assertHasPermission)(cancelledBy.permissions, 'approval:cancel');
        const approval = await this._getPendingApproval(approvalId);
        const updated = await prisma_client_1.prisma.workflow_Approval.update({
            where: { id: approvalId },
            data: {
                status: workflow_enum_1.WorkflowApprovalStatus.Cancelled,
                completed_at: new Date(),
            },
            include: approvalInclude,
        });
        const recipientIds = new Set();
        for (const step of approval.steps) {
            const ids = await this._stepRecipientIds({
                approverId: step.approver_id,
                requiredPermission: step.required_permission,
            });
            ids.forEach((id) => recipientIds.add(id));
        }
        recipientIds.forEach((recipientId) => this._queueNotification(recipientId, {
            title: 'Approval cancelled',
            body: `The ${approval.entity_type} approval request has been cancelled.`,
            type: 'warning',
            referenceType: 'workflow_approval',
            referenceId: approvalId,
        }));
        logger_util_1.logger.info('Workflow approval cancelled', { approvalId, actorId: cancelledBy.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: cancelledBy.id,
            action: 'workflow.approval.cancel',
            module: 'workflow',
            entityType: approval.entity_type,
            entityId: approval.entity_id,
            newValues: { approvalId },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(updated);
    }
    async _resolveApproverChain(db, entityType, entityId) {
        const matrix = await (0, audit_config_utility_1.getApprovalMatrix)();
        const chain = this._chainForEntity(matrix, entityType);
        if (chain.length === 0)
            return [];
        // Engagement-bound entities pin levels marked ENGAGEMENT_MANAGER_APPROVER to
        // the engagement's assigned manager (a specific person), so the manager who
        // owns the engagement reviews its working paper / report.
        const engagementManagerId = await this._resolveEngagementManager(db, entityType, entityId);
        const managerPermission = ENGAGEMENT_MANAGER_PERMISSION[entityType];
        const specs = [];
        for (const level of chain) {
            if (level === audit_config_utility_1.ENGAGEMENT_MANAGER_APPROVER) {
                if (!engagementManagerId) {
                    throw app_error_1.AppError.badRequest(`No engagement manager available for ${entityType} approval`);
                }
                if (!managerPermission) {
                    throw app_error_1.AppError.badRequest(`No approver permission configured for ${entityType} manager approval`);
                }
                // Pinned to the engagement's manager, who must still hold the permission to act.
                specs.push({ approverId: engagementManagerId, requiredPermission: managerPermission });
                continue;
            }
            // `level` is a permission slug: any active holder may act. Ensure at least
            // one exists so the level can't dead-end.
            const hasHolder = await this._hasActiveUserWithPermission(db, level);
            if (!hasHolder) {
                throw app_error_1.AppError.badRequest(`No active user holding permission '${level}' is available for ${entityType} approval`);
            }
            specs.push({ approverId: null, requiredPermission: level });
        }
        return specs;
    }
    _chainForEntity(matrix, entityType) {
        switch (entityType) {
            case workflow_enum_1.WorkflowEntityType.AuditPlan:
                return matrix.auditPlan;
            case workflow_enum_1.WorkflowEntityType.AuditWorkingPaper:
                return matrix.workingPaper;
            case workflow_enum_1.WorkflowEntityType.AuditReport:
                return matrix.auditReport;
            default:
                return [];
        }
    }
    async _resolveEngagementManager(db, entityType, entityId) {
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper) {
            const paper = await db.audit_Working_Paper.findFirst({
                where: { id: entityId, deleted_at: null },
                select: { engagement: { select: { audit_manager_id: true } } },
            });
            if (!paper)
                throw app_error_1.AppError.notFound('Audit working paper');
            return paper.engagement.audit_manager_id;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditReport) {
            const report = await db.audit_Report.findFirst({
                where: { id: entityId, deleted_at: null },
                select: { engagement: { select: { audit_manager_id: true } } },
            });
            if (!report)
                throw app_error_1.AppError.notFound('Audit report');
            return report.engagement.audit_manager_id;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditPlan) {
            const plan = await db.audit_Plan.findFirst({ where: { id: entityId, deleted_at: null }, select: { id: true } });
            if (!plan)
                throw app_error_1.AppError.notFound('Audit plan');
        }
        return null;
    }
    async _hasActiveUserWithPermission(db, permissionSlug) {
        const user = await db.user.findFirst({
            where: this._activeHolderWhere(permissionSlug),
            select: { id: true },
        });
        return user !== null;
    }
    /** All active users who currently hold a permission — the pool that can act on a pool level. */
    async _stepRecipientIds(step) {
        if (step.approverId)
            return [step.approverId];
        if (!step.requiredPermission)
            return [];
        const users = await prisma_client_1.prisma.user.findMany({
            where: this._activeHolderWhere(step.requiredPermission),
            select: { id: true },
        });
        return users.map((user) => user.id);
    }
    _activeHolderWhere(permissionSlug) {
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
    async _getPendingApproval(approvalId) {
        const approval = await prisma_client_1.prisma.workflow_Approval.findUnique({
            where: { id: approvalId },
            include: approvalInclude,
        });
        if (!approval)
            throw app_error_1.AppError.notFound('Workflow approval');
        if (approval.status !== workflow_enum_1.WorkflowApprovalStatus.Pending) {
            throw app_error_1.AppError.badRequest('Only pending approvals can be acted on');
        }
        return approval;
    }
    _getActionableStep(approval, actor) {
        const step = approval.steps.find((item) => item.level === approval.current_level);
        if (!step)
            throw app_error_1.AppError.badRequest('Approval has no pending current step');
        if (step.status !== workflow_enum_1.WorkflowApprovalStepStatus.Pending) {
            throw app_error_1.AppError.badRequest('Current approval step has already been actioned');
        }
        // A step always requires its permission. A pinned step additionally requires
        // the actor to be that specific user (the engagement's manager); a pool step
        // is open to any holder of the permission.
        const holdsPermission = !step.required_permission || actor.permissions.includes(step.required_permission);
        const isPinnedApprover = step.approver_id === null || step.approver_id === actor.id;
        if (!holdsPermission || !isPinnedApprover) {
            throw app_error_1.AppError.forbidden('You are not authorized to act on the current approval step');
        }
        return step;
    }
    async _notifyUser(userId, notification, context = {}) {
        const user = await prisma_client_1.prisma.user.findFirst({
            where: { id: userId, deleted_at: null, is_active: true },
            select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
        });
        if (!user)
            return;
        const recipientName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
        const variables = context.variables
            ? { recipientName, ...context.variables }
            : undefined;
        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
            userId: user.id,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            referenceType: notification.referenceType,
            referenceId: notification.referenceId,
            eventKey: context.eventKey,
            variables,
        });
        await notification_queue_service_1.notificationQueueService.enqueue('email', {
            to: user.email,
            subject: notification.title,
            text: notification.body,
            eventKey: context.eventKey,
            variables,
        });
    }
    _queueNotification(userId, notification, context = {}) {
        void this._notifyUser(userId, notification, context).catch((err) => {
            logger_util_1.logger.warn('Workflow approval notification failed', { err, userId });
        });
    }
    async _resolveEntityReference(entityType, entityId) {
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditReport) {
            const report = await prisma_client_1.prisma.audit_Report.findUnique({
                where: { id: entityId },
                select: { title: true, engagement: { select: { reference_number: true } } },
            });
            return report?.engagement.reference_number ?? entityId;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper) {
            const wp = await prisma_client_1.prisma.audit_Working_Paper.findUnique({
                where: { id: entityId },
                select: { title: true },
            });
            return wp?.title ?? entityId;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditPlan) {
            const plan = await prisma_client_1.prisma.audit_Plan.findUnique({
                where: { id: entityId },
                select: { title: true },
            });
            return plan?.title ?? entityId;
        }
        return entityId;
    }
    async _resolveActorName(userId) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id: userId },
            select: { display_name: true, first_name: true, last_name: true },
        });
        if (!user)
            return '';
        return user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
    }
}
exports.ApprovalService = ApprovalService;
exports.workflowApprovalService = new ApprovalService();
//# sourceMappingURL=approval.service.js.map