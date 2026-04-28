"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowApprovalService = exports.ApprovalService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_service_1 = require("../../../../messaging/service/implementation/notification.service");
const approval_status_service_1 = require("../../../../audit/approval-status/service/implementation/approval-status.service");
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
class ApprovalService {
    approvalStatusService;
    constructor(approvalStatusService = approval_status_service_1.approvalStatusService) {
        this.approvalStatusService = approvalStatusService;
    }
    async createApproval(dto, submittedBy) {
        const existing = await prisma_client_1.prisma.workflow_Approval.findFirst({
            where: {
                entity_type: dto.entityType,
                entity_id: dto.entityId,
                status: workflow_enum_1.WorkflowApprovalStatus.Pending,
            },
            select: { id: true },
        });
        if (existing)
            throw app_error_1.AppError.conflict('A pending approval already exists for this entity');
        const approverIds = await this._resolveApproverChain(dto.entityType, dto.entityId);
        if (approverIds.length === 0)
            throw app_error_1.AppError.badRequest('No approvers configured for this approval');
        const approval = await prisma_client_1.prisma.$transaction(async (tx) => {
            const created = await tx.workflow_Approval.create({
                data: {
                    entity_type: dto.entityType,
                    entity_id: dto.entityId,
                    submitted_by_id: submittedBy.id,
                    current_level: 1,
                },
            });
            await tx.workflow_Approval_Step.createMany({
                data: approverIds.map((approverId, index) => ({
                    approval_id: created.id,
                    level: index + 1,
                    approver_id: approverId,
                })),
            });
            return tx.workflow_Approval.findUniqueOrThrow({
                where: { id: created.id },
                include: approvalInclude,
            });
        });
        await this._notifyUser(approverIds[0], {
            title: 'Approval required',
            body: `A ${dto.entityType} requires your approval.`,
            type: 'info',
            referenceType: 'workflow_approval',
            referenceId: approval.id,
        });
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
            newValues: { approvalId: approval.id, approverIds },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(approval);
    }
    async approve(approvalId, approverId, comment) {
        const approval = await this._getPendingApproval(approvalId);
        const currentStep = this._getCurrentStepForApprover(approval, approverId);
        const nextStep = approval.steps.find((step) => step.level === approval.current_level + 1);
        const now = new Date();
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.workflow_Approval_Step.update({
                where: { id: currentStep.id },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStepStatus.Approved,
                    comment: comment ?? null,
                    acted_at: now,
                },
            });
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
                await this.approvalStatusService.markApproved(tx, approval.entity_type, approval.entity_id, approverId, now);
            }
            return tx.workflow_Approval.findUniqueOrThrow({
                where: { id: approvalId },
                include: approvalInclude,
            });
        });
        if (nextStep) {
            await this._notifyUser(nextStep.approver_id, {
                title: 'Approval required',
                body: `A ${approval.entity_type} requires your approval.`,
                type: 'info',
                referenceType: 'workflow_approval',
                referenceId: approvalId,
            });
        }
        else {
            await this._notifyUser(approval.submitted_by_id, {
                title: 'Approval completed',
                body: `Your ${approval.entity_type} has been approved.`,
                type: 'success',
                referenceType: approval.entity_type,
                referenceId: approval.entity_id,
            });
        }
        logger_util_1.logger.info('Workflow approval step approved', { approvalId, approverId });
        audit_log_service_1.auditLogService.logAsync({
            userId: approverId,
            action: 'workflow.approval.approve',
            module: 'workflow',
            entityType: approval.entity_type,
            entityId: approval.entity_id,
            newValues: { approvalId, comment },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(updated);
    }
    async reject(approvalId, approverId, reason) {
        const approval = await this._getPendingApproval(approvalId);
        const currentStep = this._getCurrentStepForApprover(approval, approverId);
        const now = new Date();
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.workflow_Approval_Step.update({
                where: { id: currentStep.id },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStepStatus.Rejected,
                    comment: reason,
                    acted_at: now,
                },
            });
            await tx.workflow_Approval.update({
                where: { id: approvalId },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStatus.Rejected,
                    rejection_reason: reason,
                    completed_at: now,
                },
            });
            await this.approvalStatusService.markRejected(tx, approval.entity_type, approval.entity_id, approverId, reason);
            return tx.workflow_Approval.findUniqueOrThrow({
                where: { id: approvalId },
                include: approvalInclude,
            });
        });
        await this._notifyUser(approval.submitted_by_id, {
            title: 'Approval rejected',
            body: `Your ${approval.entity_type} was rejected: ${reason}`,
            type: 'warning',
            referenceType: approval.entity_type,
            referenceId: approval.entity_id,
        });
        logger_util_1.logger.info('Workflow approval rejected', { approvalId, approverId });
        audit_log_service_1.auditLogService.logAsync({
            userId: approverId,
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
    async getPendingApprovalsForUser(userId, pagination) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(pagination);
        const candidateSteps = await prisma_client_1.prisma.workflow_Approval_Step.findMany({
            where: {
                approver_id: userId,
                status: workflow_enum_1.WorkflowApprovalStepStatus.Pending,
                approval: { status: workflow_enum_1.WorkflowApprovalStatus.Pending },
            },
            include: { approval: { include: approvalInclude } },
            orderBy: { created_at: 'asc' },
        });
        const approvals = candidateSteps
            .filter((step) => step.level === step.approval.current_level)
            .map((step) => step.approval);
        const paged = approvals.slice(skip, skip + take);
        return {
            approvals: paged.map(approval_response_dto_1.mapApprovalToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(approvals.length, page, pageSize),
        };
    }
    async cancelApproval(approvalId, cancelledBy) {
        (0, workflow_utility_1.assertHasRole)(cancelledBy.roles, workflow_utility_1.WORKFLOW_ADMIN_ROLES);
        const approval = await this._getPendingApproval(approvalId);
        const updated = await prisma_client_1.prisma.workflow_Approval.update({
            where: { id: approvalId },
            data: {
                status: workflow_enum_1.WorkflowApprovalStatus.Cancelled,
                completed_at: new Date(),
            },
            include: approvalInclude,
        });
        const approverIds = [...new Set(approval.steps.map((step) => step.approver_id))];
        await Promise.all(approverIds.map((approverId) => this._notifyUser(approverId, {
            title: 'Approval cancelled',
            body: `The ${approval.entity_type} approval request has been cancelled.`,
            type: 'warning',
            referenceType: 'workflow_approval',
            referenceId: approvalId,
        })));
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
    async _resolveApproverChain(entityType, entityId) {
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper) {
            const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
                where: { id: entityId, deleted_at: null },
                select: { engagement: { select: { audit_manager_id: true } } },
            });
            if (!paper)
                throw app_error_1.AppError.notFound('Audit working paper');
            return [paper.engagement.audit_manager_id];
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditPlan) {
            const plan = await prisma_client_1.prisma.audit_Plan.findFirst({ where: { id: entityId, deleted_at: null }, select: { id: true } });
            if (!plan)
                throw app_error_1.AppError.notFound('Audit plan');
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditReport) {
            const report = await prisma_client_1.prisma.audit_Report.findFirst({
                where: { id: entityId, deleted_at: null },
                select: { engagement: { select: { audit_manager_id: true } } },
            });
            if (!report)
                throw app_error_1.AppError.notFound('Audit report');
            const directorId = await this._getFirstActiveUserByRole('director');
            const caeId = await this._getFirstActiveUserByRole('cae');
            if (!directorId)
                throw app_error_1.AppError.badRequest('No active director user configured for audit report approval');
            if (!caeId)
                throw app_error_1.AppError.badRequest('No active CAE user configured for audit report approval');
            return [report.engagement.audit_manager_id, directorId, caeId];
        }
        const approvers = await prisma_client_1.prisma.user.findMany({
            where: {
                deleted_at: null,
                is_active: true,
                user_roles: { some: { role: { name: 'audit_admin' } } },
            },
            select: { id: true },
            orderBy: { created_at: 'asc' },
        });
        return approvers.map((approver) => approver.id);
    }
    async _getFirstActiveUserByRole(roleName) {
        const user = await prisma_client_1.prisma.user.findFirst({
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
    _getCurrentStepForApprover(approval, approverId) {
        const step = approval.steps.find((item) => item.level === approval.current_level);
        if (!step)
            throw app_error_1.AppError.badRequest('Approval has no pending current step');
        if (step.approver_id !== approverId) {
            throw app_error_1.AppError.forbidden('You are not the approver for the current approval step');
        }
        if (step.status !== workflow_enum_1.WorkflowApprovalStepStatus.Pending) {
            throw app_error_1.AppError.badRequest('Current approval step has already been actioned');
        }
        return step;
    }
    async _notifyUser(userId, notification) {
        const user = await prisma_client_1.prisma.user.findFirst({
            where: { id: userId, deleted_at: null, is_active: true },
            select: { id: true, email: true },
        });
        if (!user)
            return;
        await notification_service_1.notificationService.sendInAppNotification({
            userId: user.id,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            referenceType: notification.referenceType,
            referenceId: notification.referenceId,
        });
        await notification_service_1.notificationService.sendEmail({
            to: user.email,
            subject: notification.title,
            text: notification.body,
        }).catch((err) => {
            logger_util_1.logger.warn('Workflow approval email notification failed', { err, userId: user.id });
        });
    }
}
exports.ApprovalService = ApprovalService;
exports.workflowApprovalService = new ApprovalService();
//# sourceMappingURL=approval.service.js.map