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
const assignment_matching_util_1 = require("../../utility/assignment-matching.util");
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
        (0, workflow_utility_1.assertHasPermission)(assignedBy.permissions, 'assignment:create');
        const [engagement, user, existing] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Engagement.findFirst({
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
            prisma_client_1.prisma.user.findFirst({
                where: { id: dto.userId, deleted_at: null, is_active: true },
                select: { id: true, email: true, display_name: true, first_name: true, last_name: true, max_concurrent_engagements: true },
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
        // Capacity + schedule guard: block over-allocating an auditor across
        // engagements whose planned windows overlap this one.
        const otherActive = await prisma_client_1.prisma.workflow_Assignment.findMany({
            where: {
                user_id: dto.userId,
                engagement: {
                    id: { not: dto.engagementId },
                    deleted_at: null,
                    status: { in: assignment_matching_util_1.ACTIVE_ENGAGEMENT_STATUSES },
                },
            },
            select: {
                engagement: { select: { planned_start_date: true, planned_end_date: true } },
            },
        });
        const overlapping = otherActive.filter((a) => (0, assignment_matching_util_1.rangesOverlap)(engagement.planned_start_date, engagement.planned_end_date, a.engagement.planned_start_date, a.engagement.planned_end_date));
        const capacity = user.max_concurrent_engagements ?? assignment_matching_util_1.MAX_CONCURRENT_ENGAGEMENTS;
        if (overlapping.length >= capacity) {
            throw app_error_1.AppError.conflict(`User already has ${overlapping.length} engagements overlapping this period (capacity is ${capacity}).`);
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
        const assignment = await prisma_client_1.prisma.$transaction(async (tx) => {
            const created = await tx.workflow_Assignment.create({
                data: {
                    engagement_id: dto.engagementId,
                    user_id: dto.userId,
                    role: dto.role,
                    assigned_by_id: assignedBy.id,
                },
                include: assignmentInclude,
            });
            await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
                userId: dto.userId,
                title: 'Audit assignment',
                body: `You have been assigned to ${engagement.title} as ${dto.role}.`,
                type: 'info',
                referenceType: 'audit_engagement',
                referenceId: dto.engagementId,
                eventKey: 'workflow.assignment.created',
                variables: assignmentVariables,
            }, { tx });
            await notification_queue_service_1.notificationQueueService.enqueue('email', {
                to: user.email,
                subject: 'Audit assignment',
                text: `You have been assigned to ${engagement.title} as ${dto.role}.`,
                eventKey: 'workflow.assignment.created',
                variables: assignmentVariables,
            }, { tx });
            return created;
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
        (0, workflow_utility_1.assertHasPermission)(removedBy.permissions, 'assignment:delete');
        const assignment = await prisma_client_1.prisma.workflow_Assignment.findUnique({
            where: { id: assignmentId },
            include: {
                user: { select: { id: true, email: true } },
                engagement: { select: { id: true, title: true } },
            },
        });
        if (!assignment)
            throw app_error_1.AppError.notFound('Workflow assignment');
        await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.workflow_Assignment.delete({ where: { id: assignmentId } });
            await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
                userId: assignment.user_id,
                title: 'Audit assignment removed',
                body: `You have been unassigned from ${assignment.engagement.title}.`,
                type: 'warning',
                referenceType: 'audit_engagement',
                referenceId: assignment.engagement_id,
            }, { tx });
            await notification_queue_service_1.notificationQueueService.enqueue('email', {
                to: assignment.user.email,
                subject: 'Audit assignment removed',
                text: `You have been unassigned from ${assignment.engagement.title}.`,
            }, { tx });
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
    async getAssignments(engagementId, actor) {
        await this._assertCanViewEngagementAssignments(engagementId, actor);
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
                    status: { in: assignment_matching_util_1.ACTIVE_ENGAGEMENT_STATUSES },
                },
            },
            select: { engagement: { select: { status: true } } },
        });
        const counts = new Map();
        for (const assignment of assignments) {
            const status = assignment.engagement.status;
            counts.set(status, (counts.get(status) ?? 0) + 1);
        }
        const loggedTime = await prisma_client_1.prisma.audit_Time_Entry.aggregate({
            where: {
                user_id: userId,
                deleted_at: null,
                engagement: { deleted_at: null, status: { in: assignment_matching_util_1.ACTIVE_ENGAGEMENT_STATUSES } },
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
    async getCandidates(engagementId, actor) {
        (0, workflow_utility_1.assertHasPermission)(actor.permissions, 'assignment:create');
        // Need the engagement's audit type + priority to score skill fit and weight workload.
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { id: true, audit_type: true, priority: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        // Get already-assigned user IDs for this engagement
        const existingAssignments = await prisma_client_1.prisma.workflow_Assignment.findMany({
            where: { engagement_id: engagementId },
            select: { user_id: true },
        });
        const assignedIds = new Set(existingAssignments.map(a => a.user_id));
        // Get all active users
        const users = await prisma_client_1.prisma.user.findMany({
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
                max_concurrent_engagements: true,
            },
        });
        // Get active engagement counts per user
        const activeAssignments = await prisma_client_1.prisma.workflow_Assignment.groupBy({
            by: ['user_id'],
            where: {
                engagement: {
                    status: { in: assignment_matching_util_1.ACTIVE_ENGAGEMENT_STATUSES },
                    deleted_at: null,
                },
            },
            _count: { user_id: true },
        });
        const workloadMap = new Map(activeAssignments.map(a => [a.user_id, a._count.user_id]));
        return users
            .filter(u => !assignedIds.has(u.id))
            .map(u => {
            const skills = parseSkillsJson(u.skills);
            const activeEngagementCount = workloadMap.get(u.id) ?? 0;
            const matchedSkills = (0, assignment_matching_util_1.getMatchedSkills)(skills, engagement.audit_type);
            const skillScore = (0, assignment_matching_util_1.getSkillScore)(skills, engagement.audit_type);
            const capacity = u.max_concurrent_engagements ?? assignment_matching_util_1.MAX_CONCURRENT_ENGAGEMENTS;
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
                recommendationScore: (0, assignment_matching_util_1.getRecommendationScore)(skillScore, activeEngagementCount, engagement.priority),
                recommended: skillScore > 0 && !overCapacity,
                overCapacity,
            };
        })
            .sort((a, b) => b.recommendationScore - a.recommendationScore ||
            a.activeEngagementCount - b.activeEngagementCount);
    }
    async _assertCanViewEngagementAssignments(engagementId, actor) {
        if (actor.permissions.includes('engagement:read_all'))
            return;
        const count = await prisma_client_1.prisma.audit_Engagement.count({
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
            throw app_error_1.AppError.forbidden('You do not have access to this engagement assignments');
        }
    }
    async getActiveWorkloadMap() {
        const grouped = await prisma_client_1.prisma.workflow_Assignment.groupBy({
            by: ['user_id'],
            where: {
                engagement: {
                    status: { in: assignment_matching_util_1.ACTIVE_ENGAGEMENT_STATUSES },
                    deleted_at: null,
                },
            },
            _count: { user_id: true },
        });
        return new Map(grouped.map(a => [a.user_id, a._count.user_id]));
    }
}
exports.AssignmentService = AssignmentService;
exports.workflowAssignmentService = new AssignmentService();
function parseSkillsJson(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((s) => typeof s === 'string' && s.length > 0)
            : [];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=assignment.service.js.map