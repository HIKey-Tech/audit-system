"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowAssignmentService = exports.AssignmentService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const workflow_utility_1 = require("../../../utility/workflow.utility");
const assignment_response_dto_1 = require("../../dto/response/assignment.response.dto");
const workflowUserSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
    department: true,
    job_title: true,
});
const assignmentInclude = client_1.Prisma.validator()({
    user: { select: workflowUserSelect },
    assigned_by: { select: workflowUserSelect },
    engagement: true,
});
class AssignmentService {
    async assignStaff(dto, assignedBy) {
        (0, workflow_utility_1.assertHasRole)(assignedBy.roles, workflow_utility_1.WORKFLOW_ADMIN_ROLES);
        const [engagement, user, existing] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Engagement.findFirst({
                where: { id: dto.engagementId, deleted_at: null },
                select: { id: true, title: true, reference_number: true, sla_deadline: true },
            }),
            prisma_client_1.prisma.user.findFirst({
                where: { id: dto.userId, deleted_at: null, is_active: true },
                select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
            }),
            prisma_client_1.prisma.workflow_Assignment.findFirst({
                where: {
                    engagement_id: dto.engagementId,
                    user_id: dto.userId,
                    role: dto.role,
                },
                select: { id: true },
            }),
        ]);
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (!user)
            throw app_error_1.AppError.notFound('User');
        if (existing)
            throw app_error_1.AppError.conflict('User is already assigned to this engagement in that role');
        const assignment = await prisma_client_1.prisma.workflow_Assignment.create({
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
        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
            userId: dto.userId,
            title: 'Audit assignment',
            body: `You have been assigned to ${engagement.title} as ${dto.role}.`,
            type: 'info',
            referenceType: 'audit_engagement',
            referenceId: dto.engagementId,
            eventKey: 'workflow.assignment.created',
            variables: assignmentVariables,
        });
        await notification_queue_service_1.notificationQueueService.enqueue('email', {
            to: user.email,
            subject: 'Audit assignment',
            text: `You have been assigned to ${engagement.title} as ${dto.role}.`,
            eventKey: 'workflow.assignment.created',
            variables: assignmentVariables,
        });
        logger_util_1.logger.info('Workflow assignment created', {
            assignmentId: assignment.id,
            engagementId: dto.engagementId,
            userId: dto.userId,
            actorId: assignedBy.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: assignedBy.id,
            action: 'workflow.assignment.create',
            module: 'workflow',
            entityType: 'audit_engagement',
            entityId: dto.engagementId,
            newValues: dto,
        });
        return (0, assignment_response_dto_1.mapAssignmentToResponse)(assignment);
    }
    async removeAssignment(assignmentId, removedBy) {
        (0, workflow_utility_1.assertHasRole)(removedBy.roles, workflow_utility_1.WORKFLOW_ADMIN_ROLES);
        const assignment = await prisma_client_1.prisma.workflow_Assignment.findUnique({
            where: { id: assignmentId },
            include: {
                user: { select: { id: true, email: true } },
                engagement: { select: { id: true, title: true } },
            },
        });
        if (!assignment)
            throw app_error_1.AppError.notFound('Workflow assignment');
        await prisma_client_1.prisma.workflow_Assignment.delete({ where: { id: assignmentId } });
        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
            userId: assignment.user_id,
            title: 'Audit assignment removed',
            body: `You have been unassigned from ${assignment.engagement.title}.`,
            type: 'warning',
            referenceType: 'audit_engagement',
            referenceId: assignment.engagement_id,
        });
        await notification_queue_service_1.notificationQueueService.enqueue('email', {
            to: assignment.user.email,
            subject: 'Audit assignment removed',
            text: `You have been unassigned from ${assignment.engagement.title}.`,
        });
        logger_util_1.logger.info('Workflow assignment removed', { assignmentId, actorId: removedBy.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: removedBy.id,
            action: 'workflow.assignment.remove',
            module: 'workflow',
            entityType: 'audit_engagement',
            entityId: assignment.engagement_id,
            oldValues: { userId: assignment.user_id, role: assignment.role },
        });
    }
    async getAssignments(engagementId) {
        const assignments = await prisma_client_1.prisma.workflow_Assignment.findMany({
            where: { engagement_id: engagementId },
            include: assignmentInclude,
            orderBy: { assigned_at: 'asc' },
        });
        return assignments.map(assignment_response_dto_1.mapAssignmentToResponse);
    }
    async getMyAssignments(userId, filters) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(filters);
        const where = {
            user_id: userId,
            engagement: {
                deleted_at: null,
                ...(filters.status && { status: filters.status }),
            },
        };
        const [total, assignments] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.workflow_Assignment.count({ where }),
            prisma_client_1.prisma.workflow_Assignment.findMany({
                where,
                include: assignmentInclude,
                orderBy: { assigned_at: 'desc' },
                skip,
                take,
            }),
        ]);
        return {
            assignments: assignments.map(assignment_response_dto_1.mapAssignmentToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async getUserWorkload(userId) {
        const user = await prisma_client_1.prisma.user.findFirst({
            where: { id: userId, deleted_at: null, is_active: true },
            select: { id: true },
        });
        if (!user)
            throw app_error_1.AppError.notFound('User');
        const assignments = await prisma_client_1.prisma.workflow_Assignment.findMany({
            where: {
                user_id: userId,
                engagement: {
                    deleted_at: null,
                    status: { notIn: ['reported', 'closed'] },
                },
            },
            select: { engagement: { select: { status: true } } },
        });
        const counts = new Map();
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
}
exports.AssignmentService = AssignmentService;
exports.workflowAssignmentService = new AssignmentService();
//# sourceMappingURL=assignment.service.js.map