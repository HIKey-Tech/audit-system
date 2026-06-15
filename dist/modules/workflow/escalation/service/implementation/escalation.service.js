"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowEscalationService = exports.EscalationService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const workflow_enum_1 = require("../../../domain/enum/workflow.enum");
const workflow_utility_1 = require("../../../utility/workflow.utility");
const escalation_response_dto_1 = require("../../dto/response/escalation.response.dto");
const workflowUserSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
    department: true,
    job_title: true,
});
const escalationInclude = client_1.Prisma.validator()({
    escalated_to: { select: workflowUserSelect },
});
class EscalationService {
    async checkAndEscalate() {
        const result = {
            checkedEngagements: 0,
            checkedApprovals: 0,
            checkedRequests: 0,
            escalationsFired: 0,
            failures: 0,
        };
        const now = new Date();
        const engagements = await prisma_client_1.prisma.audit_Engagement.findMany({
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
                const latest = await this._getLatestEscalation(workflow_enum_1.WorkflowEscalationEntityType.AuditEngagement, engagement.id);
                const level = latest ? latest.escalation_level + 1 : 1;
                if (level > 4)
                    continue;
                const thresholds = await this._getPolicyThresholds(engagement.audit_type);
                const basis = latest?.notified_at ?? engagement.sla_deadline;
                if (!(0, workflow_utility_1.hasElapsed)(basis, this._thresholdForLevel(thresholds, level), now))
                    continue;
                const fired = await this._fireEscalation(workflow_enum_1.WorkflowEscalationEntityType.AuditEngagement, engagement.id, level, workflow_enum_1.WorkflowEscalationReason.SlaBreach);
                result.escalationsFired += fired;
            }
            catch (err) {
                result.failures += 1;
                logger_util_1.logger.error('Workflow engagement escalation failed', { err, engagementId: engagement.id });
            }
        }
        const approvals = await prisma_client_1.prisma.workflow_Approval.findMany({
            where: { status: workflow_enum_1.WorkflowApprovalStatus.Pending },
            select: { id: true, created_at: true },
        });
        result.checkedApprovals = approvals.length;
        const approvalThresholds = await this._getPolicyThresholds(workflow_enum_1.EscalationPolicyAuditType.All);
        for (const approval of approvals) {
            try {
                const latest = await this._getLatestEscalation(workflow_enum_1.WorkflowEscalationEntityType.WorkflowApproval, approval.id);
                const level = latest ? latest.escalation_level + 1 : 1;
                if (level > 4)
                    continue;
                const basis = latest?.notified_at ?? approval.created_at;
                if (!(0, workflow_utility_1.hasElapsed)(basis, this._thresholdForLevel(approvalThresholds, level), now))
                    continue;
                const fired = await this._fireEscalation(workflow_enum_1.WorkflowEscalationEntityType.WorkflowApproval, approval.id, level, workflow_enum_1.WorkflowEscalationReason.ApprovalInaction);
                result.escalationsFired += fired;
            }
            catch (err) {
                result.failures += 1;
                logger_util_1.logger.error('Workflow approval escalation failed', { err, approvalId: approval.id });
            }
        }
        // Ad-hoc requests: remind the current recipient (L1), then notify the
        // initiator (L2). No role chain beyond that since recipients are user-picked.
        const pendingRequests = await prisma_client_1.prisma.workflow_Request.findMany({
            where: { status: 'pending', deleted_at: null },
            select: { id: true, created_at: true },
        });
        result.checkedRequests = pendingRequests.length;
        for (const request of pendingRequests) {
            try {
                const latest = await this._getLatestEscalation(workflow_enum_1.WorkflowEscalationEntityType.WorkflowRequest, request.id);
                const level = latest ? latest.escalation_level + 1 : 1;
                if (level > 2)
                    continue;
                const basis = latest?.notified_at ?? request.created_at;
                if (!(0, workflow_utility_1.hasElapsed)(basis, this._thresholdForLevel(approvalThresholds, level), now))
                    continue;
                const fired = await this._fireEscalation(workflow_enum_1.WorkflowEscalationEntityType.WorkflowRequest, request.id, level, workflow_enum_1.WorkflowEscalationReason.ApprovalInaction);
                result.escalationsFired += fired;
            }
            catch (err) {
                result.failures += 1;
                logger_util_1.logger.error('Workflow request escalation failed', { err, requestId: request.id });
            }
        }
        logger_util_1.logger.info('Workflow escalation check completed', result);
        return result;
    }
    async acknowledgeEscalation(escalationId, userId) {
        const escalation = await prisma_client_1.prisma.workflow_Escalation.findUnique({
            where: { id: escalationId },
            select: { id: true, escalated_to_id: true },
        });
        if (!escalation)
            throw app_error_1.AppError.notFound('Workflow escalation');
        if (escalation.escalated_to_id !== userId) {
            throw app_error_1.AppError.forbidden('Only the notified user can acknowledge this escalation');
        }
        const updated = await prisma_client_1.prisma.workflow_Escalation.update({
            where: { id: escalationId },
            data: { acknowledged_at: new Date() },
            include: escalationInclude,
        });
        logger_util_1.logger.info('Workflow escalation acknowledged', { escalationId, userId });
        audit_log_service_1.auditLogService.logAsync({
            userId,
            action: 'workflow.escalation.acknowledge',
            module: 'workflow',
            entityType: updated.entity_type,
            entityId: updated.entity_id,
            newValues: { escalationId },
        });
        return (0, escalation_response_dto_1.mapEscalationToResponse)(updated);
    }
    async getEscalationHistory(entityType, entityId) {
        const escalations = await prisma_client_1.prisma.workflow_Escalation.findMany({
            where: { entity_type: entityType, entity_id: entityId },
            include: escalationInclude,
            orderBy: { created_at: 'desc' },
        });
        return escalations.map(escalation_response_dto_1.mapEscalationToResponse);
    }
    async listEscalationPolicies() {
        const policies = await prisma_client_1.prisma.escalation_Policy.findMany({
            where: { is_active: true },
            orderBy: { audit_type: 'asc' },
        });
        return policies.map(escalation_response_dto_1.mapEscalationPolicyToResponse);
    }
    async createOrUpdateEscalationPolicy(dto, updatedBy) {
        (0, workflow_utility_1.assertHasPermission)(updatedBy.permissions, 'escalation_policy:update');
        const policy = await prisma_client_1.prisma.escalation_Policy.upsert({
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
        logger_util_1.logger.info('Workflow escalation policy upserted', { auditType: dto.auditType, actorId: updatedBy.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: updatedBy.id,
            action: 'workflow.escalation_policy.upsert',
            module: 'workflow',
            entityType: 'escalation_policy',
            entityId: policy.id,
            newValues: dto,
        });
        return (0, escalation_response_dto_1.mapEscalationPolicyToResponse)(policy);
    }
    async _fireEscalation(entityType, entityId, level, reason) {
        const targets = await this._resolveEscalationTargets(entityType, entityId, level);
        if (targets.length === 0) {
            logger_util_1.logger.warn('Workflow escalation skipped: no targets resolved', { entityType, entityId, level });
            return 0;
        }
        const escalations = await prisma_client_1.prisma.$transaction(targets.map((target) => prisma_client_1.prisma.workflow_Escalation.create({
            data: {
                entity_type: entityType,
                entity_id: entityId,
                escalation_level: level,
                escalated_to_id: target.id,
                reason,
            },
        })));
        await Promise.all(targets.map((target) => this._notifyTarget(target, entityType, entityId, level, reason)));
        for (const escalation of escalations) {
            audit_log_service_1.auditLogService.logAsync({
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
        logger_util_1.logger.info('Workflow escalation fired', { entityType, entityId, level, reason, targetCount: targets.length });
        return targets.length;
    }
    async _resolveEscalationTargets(entityType, entityId, level) {
        const targetSelect = {
            id: true,
            email: true,
            display_name: true,
            first_name: true,
            last_name: true,
        };
        const matrix = await (0, workflow_utility_1.getEscalationMatrix)();
        if (entityType === workflow_enum_1.WorkflowEscalationEntityType.AuditEngagement) {
            const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
                where: { id: entityId, deleted_at: null },
                select: {
                    lead_auditor: { select: targetSelect },
                    audit_manager: { select: targetSelect },
                },
            });
            if (!engagement)
                throw app_error_1.AppError.notFound('Audit engagement');
            if (level === 1)
                return [engagement.lead_auditor];
            if (level === 2)
                return [engagement.audit_manager];
            if (level === 3)
                return this._getUsersByRoles(matrix.auditEngagement.level3);
            return this._getUsersByRoles(matrix.auditEngagement.beyond);
        }
        if (entityType === workflow_enum_1.WorkflowEscalationEntityType.WorkflowRequest) {
            const request = await prisma_client_1.prisma.workflow_Request.findFirst({
                where: { id: entityId, deleted_at: null },
                select: {
                    initiator: { select: targetSelect },
                    current_level: true,
                    steps: { select: { level: true, recipient: { select: targetSelect } } },
                },
            });
            if (!request)
                throw app_error_1.AppError.notFound('Workflow request');
            if (level === 1) {
                const currentStep = request.steps.find((step) => step.level === request.current_level);
                return currentStep ? [currentStep.recipient] : [];
            }
            return [request.initiator];
        }
        const approval = await prisma_client_1.prisma.workflow_Approval.findUnique({
            where: { id: entityId },
            select: {
                current_level: true,
                steps: {
                    where: { status: workflow_enum_1.WorkflowApprovalStepStatus.Pending },
                    select: {
                        level: true,
                        required_permission: true,
                        approver: { select: targetSelect },
                    },
                },
            },
        });
        if (!approval)
            throw app_error_1.AppError.notFound('Workflow approval');
        if (level === 1) {
            const currentStep = approval.steps.find((step) => step.level === approval.current_level);
            if (!currentStep)
                return [];
            // Pinned step: that approver. Pool step (no pinned approver): the whole
            // permission pool, so a stuck approval nudges everyone who can act.
            if (currentStep.approver)
                return [currentStep.approver];
            if (currentStep.required_permission)
                return this._getUsersByPermission(currentStep.required_permission);
            return [];
        }
        if (level === 3)
            return this._getUsersByRoles(matrix.workflowApproval.level3);
        if (level === 4)
            return this._getUsersByRoles(matrix.workflowApproval.level4);
        return this._getUsersByRoles(matrix.workflowApproval.otherwise);
    }
    async _getUsersByRoles(roleNames) {
        if (roleNames.length === 0)
            return [];
        return prisma_client_1.prisma.user.findMany({
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
    async _getUsersByPermission(permissionSlug) {
        return prisma_client_1.prisma.user.findMany({
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
    async _getLatestEscalation(entityType, entityId) {
        return prisma_client_1.prisma.workflow_Escalation.findFirst({
            where: { entity_type: entityType, entity_id: entityId },
            select: { escalation_level: true, notified_at: true },
            orderBy: [{ escalation_level: 'desc' }, { notified_at: 'desc' }],
        });
    }
    async _getPolicyThresholds(auditType) {
        const policy = await prisma_client_1.prisma.escalation_Policy.findFirst({
            where: { audit_type: auditType, is_active: true },
        }) ?? await prisma_client_1.prisma.escalation_Policy.findFirst({
            where: { audit_type: workflow_enum_1.EscalationPolicyAuditType.All, is_active: true },
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
    _thresholdForLevel(thresholds, level) {
        if (level === 1)
            return thresholds.level1Hours;
        if (level === 2)
            return thresholds.level2Hours;
        if (level === 3)
            return thresholds.level3Hours;
        return thresholds.level4Hours;
    }
    async _notifyTarget(target, entityType, entityId, level, reason) {
        const title = `Workflow escalation level ${level}`;
        const body = `Escalation level ${level} fired for ${entityType} due to ${reason}.`;
        const recipientName = target.display_name ?? `${target.first_name} ${target.last_name}`.trim();
        let eventKey;
        let variables;
        if (entityType === workflow_enum_1.WorkflowEscalationEntityType.AuditEngagement) {
            const engagement = await prisma_client_1.prisma.audit_Engagement.findUnique({
                where: { id: entityId },
                select: { title: true, reference_number: true, sla_deadline: true, status: true },
            });
            if (engagement) {
                const now = new Date();
                const daysOverdue = Math.max(0, Math.ceil((now.getTime() - engagement.sla_deadline.getTime()) / 86_400_000));
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
        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
            userId: target.id,
            title,
            body,
            type: 'warning',
            referenceType: entityType,
            referenceId: entityId,
            eventKey,
            variables,
        });
        await notification_queue_service_1.notificationQueueService.enqueue('email', {
            to: target.email,
            subject: title,
            text: body,
            eventKey,
            variables,
        });
    }
}
exports.EscalationService = EscalationService;
exports.workflowEscalationService = new EscalationService();
//# sourceMappingURL=escalation.service.js.map