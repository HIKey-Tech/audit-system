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
const workflow_enum_1 = require("../../../domain/enum/workflow.enum");
const workflow_utility_1 = require("../../../utility/workflow.utility");
const assignment_matching_util_1 = require("../../utility/assignment-matching.util");
const assignment_response_dto_1 = require("../../dto/response/assignment.response.dto");
const approval_service_1 = require("../../../approval/service/implementation/approval.service");
const lifecycle_notify_utility_1 = require("../../../../audit/utility/lifecycle-notify.utility");
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
/**
 * Audit staff are identified by permission, never by role name: roles are admin-defined, so
 * any role that can author working papers makes its holders assignable (same test as the
 * lead-auditor picker in the engagement module).
 */
const AUDIT_STAFF_PERMISSIONS = ['working_paper:create'];
const auditStaffRoleFilter = {
    role_permissions: { some: { permission: { slug: { in: AUDIT_STAFF_PERMISSIONS } } } },
};
class AssignmentService {
    async assignStaff(dto, assignedBy) {
        (0, workflow_utility_1.assertHasPermission)(assignedBy.permissions, 'assignment:create');
        const [engagement, user, existing] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Engagement.findFirst({
                where: { id: dto.engagementId, deleted_at: null },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    reference_number: true,
                    sla_deadline: true,
                    planned_start_date: true,
                    planned_end_date: true,
                    lead_auditor_id: true,
                    audit_manager_id: true,
                    auditee_id: true,
                },
            }),
            prisma_client_1.prisma.user.findFirst({
                where: { id: dto.userId, deleted_at: null, is_active: true },
                select: { id: true, email: true, display_name: true, first_name: true, last_name: true, max_concurrent_engagements: true, is_super_admin: true },
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
        if (engagement.status === 'closed') {
            throw app_error_1.AppError.badRequest('Cannot change the team of a closed engagement');
        }
        if (!user)
            throw app_error_1.AppError.notFound('User');
        // Super admin holds every permission, so the permission-based staff test below
        // would always admit them; platform administrators are not audit staff.
        if (user.is_super_admin) {
            throw app_error_1.AppError.badRequest('A platform administrator cannot be assigned to an audit team');
        }
        // Segregation of duties: the engagement's own lead, manager and auditee already
        // hold a role on it and cannot also be added to the team.
        if ([engagement.lead_auditor_id, engagement.audit_manager_id, engagement.auditee_id].includes(dto.userId)) {
            throw app_error_1.AppError.badRequest('This user already holds the lead auditor, audit manager or auditee role on this engagement');
        }
        const isAuditStaff = await prisma_client_1.prisma.user_Role.count({
            where: { user_id: dto.userId, role: auditStaffRoleFilter },
        });
        if (isAuditStaff === 0)
            throw app_error_1.AppError.badRequest('Only audit staff can be assigned to an engagement team');
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
        const olaDeadlineFormatted = engagement.sla_deadline.toISOString().slice(0, 10);
        const assignmentVariables = {
            assigneeName,
            engagementTitle: engagement.title,
            engagementReference: engagement.reference_number,
            assignmentRole: dto.role,
            olaDeadline: olaDeadlineFormatted,
            slaDeadline: olaDeadlineFormatted,
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
                subject: `Audit Assignment: ${engagement.title}`,
                text: `Dear ${assigneeName},\n\nYou have been assigned to an audit engagement.\n\nEngagement: ${engagement.title}\nReference: ${engagement.reference_number}\nRole: ${dto.role}\nOLA Deadline: ${olaDeadlineFormatted}\n\nPlease log in to IAMS to begin your work.\n\nRegards,\nIAMS — Internal Audit System`,
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
    async substituteStaff(dto, actor) {
        const canSubstitute = actor.permissions.includes('assignment:create') ||
            actor.permissions.includes('engagement:update') ||
            actor.permissions.includes('*');
        if (!canSubstitute) {
            throw app_error_1.AppError.forbidden('You do not have permission to substitute engagement team members');
        }
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: dto.engagementId, deleted_at: null },
            select: {
                id: true,
                title: true,
                status: true,
                reference_number: true,
                sla_deadline: true,
                lead_auditor_id: true,
                audit_manager_id: true,
                auditee_id: true,
            },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (engagement.status === 'closed') {
            throw app_error_1.AppError.badRequest('Cannot substitute team members on a closed engagement');
        }
        const incomingUser = await prisma_client_1.prisma.user.findFirst({
            where: { id: dto.incomingUserId, deleted_at: null, is_active: true },
            include: {
                user_roles: {
                    include: {
                        role: {
                            include: {
                                role_permissions: { include: { permission: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!incomingUser)
            throw app_error_1.AppError.notFound('Incoming substitute user');
        if (incomingUser.is_super_admin) {
            throw app_error_1.AppError.badRequest('A platform administrator cannot be assigned to an audit team');
        }
        if (incomingUser.id === engagement.auditee_id) {
            throw app_error_1.AppError.badRequest('The auditee on this engagement cannot be assigned to the audit team');
        }
        const incomingPerms = new Set(incomingUser.user_roles.flatMap((ur) => ur.role.role_permissions.map((rp) => rp.permission.slug)));
        const resolvedOutgoingId = dto.outgoingUserId ??
            (dto.role === 'lead_auditor'
                ? engagement.lead_auditor_id
                : dto.role === 'audit_manager'
                    ? engagement.audit_manager_id
                    : null);
        if (resolvedOutgoingId && resolvedOutgoingId === dto.incomingUserId) {
            throw app_error_1.AppError.badRequest('Incoming team member must be different from the outgoing member');
        }
        const outgoingUser = resolvedOutgoingId
            ? await prisma_client_1.prisma.user.findUnique({
                where: { id: resolvedOutgoingId },
                select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
            })
            : null;
        if (dto.role === 'audit_manager') {
            const requiredManagerPerms = ['working_paper:approve', 'report:approve', 'finding:close'];
            const missing = requiredManagerPerms.filter((p) => !incomingPerms.has(p));
            if (missing.length > 0) {
                throw app_error_1.AppError.badRequest(`Substitute audit manager must hold approval permissions: ${missing.join(', ')}`);
            }
            if (dto.incomingUserId === engagement.lead_auditor_id) {
                throw app_error_1.AppError.badRequest('Audit manager and lead auditor must be different people');
            }
            await prisma_client_1.prisma.$transaction(async (tx) => {
                await tx.audit_Engagement.update({
                    where: { id: dto.engagementId },
                    data: { audit_manager_id: dto.incomingUserId },
                });
                await tx.workflow_Assignment.deleteMany({
                    where: { engagement_id: dto.engagementId, user_id: dto.incomingUserId },
                });
                await approval_service_1.workflowApprovalService.reassignEngagementManagerApprovals(dto.engagementId, engagement.audit_manager_id, dto.incomingUserId, tx);
            });
        }
        else if (dto.role === 'lead_auditor') {
            if (!incomingPerms.has('working_paper:create')) {
                throw app_error_1.AppError.badRequest('Substitute lead auditor must hold fieldwork permission (working_paper:create)');
            }
            if (dto.incomingUserId === engagement.audit_manager_id) {
                throw app_error_1.AppError.badRequest('Lead auditor and audit manager must be different people');
            }
            await prisma_client_1.prisma.$transaction(async (tx) => {
                await tx.audit_Engagement.update({
                    where: { id: dto.engagementId },
                    data: { lead_auditor_id: dto.incomingUserId },
                });
                await tx.workflow_Assignment.deleteMany({
                    where: { engagement_id: dto.engagementId, user_id: dto.incomingUserId },
                });
            });
        }
        else {
            // supporting_auditor
            if (!incomingPerms.has('working_paper:create')) {
                throw app_error_1.AppError.badRequest('Substitute supporting auditor must hold fieldwork permission (working_paper:create)');
            }
            if ([engagement.lead_auditor_id, engagement.audit_manager_id].includes(dto.incomingUserId)) {
                throw app_error_1.AppError.badRequest('This user is already the lead auditor or audit manager on this engagement');
            }
            await prisma_client_1.prisma.$transaction(async (tx) => {
                if (resolvedOutgoingId) {
                    await tx.workflow_Assignment.deleteMany({
                        where: { engagement_id: dto.engagementId, user_id: resolvedOutgoingId },
                    });
                }
                const alreadyAssigned = await tx.workflow_Assignment.findFirst({
                    where: {
                        engagement_id: dto.engagementId,
                        user_id: dto.incomingUserId,
                        role: workflow_enum_1.WorkflowAssignmentRole.SupportingAuditor,
                    },
                    select: { id: true },
                });
                if (!alreadyAssigned) {
                    await tx.workflow_Assignment.create({
                        data: {
                            engagement_id: dto.engagementId,
                            user_id: dto.incomingUserId,
                            role: workflow_enum_1.WorkflowAssignmentRole.SupportingAuditor,
                            assigned_by_id: actor.id,
                        },
                    });
                }
            });
        }
        const incomingUserName = incomingUser.display_name?.trim() || `${incomingUser.first_name} ${incomingUser.last_name}`.trim();
        const outgoingUserName = outgoingUser
            ? outgoingUser.display_name?.trim() || `${outgoingUser.first_name} ${outgoingUser.last_name}`.trim()
            : 'None (Additional Substitute)';
        const olaDeadlineFormatted = engagement.sla_deadline.toISOString().slice(0, 10);
        const roleLabel = dto.role === 'audit_manager'
            ? 'Audit Manager'
            : dto.role === 'lead_auditor'
                ? 'Lead Auditor'
                : 'Supporting Auditor';
        // Notify incoming user, outgoing user, lead, manager, and oversight holders
        const oversightUsers = await prisma_client_1.prisma.user.findMany({
            where: {
                deleted_at: null,
                is_active: true,
                user_roles: {
                    some: {
                        role: {
                            role_permissions: {
                                some: { permission: { slug: { in: [lifecycle_notify_utility_1.LIFECYCLE_NOTIFY_PERMISSION, '*'] } } },
                            },
                        },
                    },
                },
            },
            select: { id: true },
        });
        const notifyIds = new Set([
            dto.incomingUserId,
            ...(resolvedOutgoingId ? [resolvedOutgoingId] : []),
            engagement.lead_auditor_id,
            engagement.audit_manager_id,
            ...oversightUsers.map((u) => u.id),
        ]);
        const recipients = await prisma_client_1.prisma.user.findMany({
            where: { id: { in: Array.from(notifyIds) }, deleted_at: null, is_active: true },
            select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
        });
        for (const r of recipients) {
            const recipientName = r.display_name?.trim() || `${r.first_name} ${r.last_name}`.trim() || r.email;
            const variables = {
                recipientName,
                engagementTitle: engagement.title,
                engagementReference: engagement.reference_number,
                assignmentRole: roleLabel,
                outgoingUserName,
                incomingUserName,
                reason: dto.reason,
                olaDeadline: olaDeadlineFormatted,
                slaDeadline: olaDeadlineFormatted,
            };
            await notification_queue_service_1.notificationQueueService.enqueueSafe('in_app', {
                userId: r.id,
                title: `Audit Team Substitution: ${engagement.reference_number}`,
                body: `Team substitution on "${engagement.title}" (${engagement.reference_number}): ${incomingUserName} assigned as ${roleLabel} (replacing ${outgoingUserName}). Reason: ${dto.reason}`,
                type: 'info',
                referenceType: 'audit_engagement',
                referenceId: dto.engagementId,
                eventKey: 'workflow.assignment.substituted',
                variables,
            });
            if (r.email) {
                await notification_queue_service_1.notificationQueueService.enqueueSafe('email', {
                    to: r.email,
                    subject: `Audit Team Substitution (${engagement.reference_number}): ${engagement.title}`,
                    text: `Dear ${recipientName},\n\nA team member substitution has been recorded on audit engagement "${engagement.title}" (${engagement.reference_number}).\n\nRole: ${roleLabel}\nPrevious Member: ${outgoingUserName}\nIncoming Member: ${incomingUserName}\nReason: ${dto.reason}\nOLA Deadline: ${olaDeadlineFormatted}\n\nPlease log in to IAMS to review the updated engagement team.\n\nRegards,\nIAMS — Internal Audit System`,
                    eventKey: 'workflow.assignment.substituted',
                    variables,
                });
            }
        }
        logger_util_1.logger.info('Audit team member substituted', {
            engagementId: dto.engagementId,
            role: dto.role,
            outgoingUserId: resolvedOutgoingId,
            incomingUserId: dto.incomingUserId,
            actorId: actor.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.assignment.substitute',
            module: 'workflow',
            entityType: 'audit_engagement',
            entityId: dto.engagementId,
            oldValues: { role: dto.role, outgoingUserId: resolvedOutgoingId, outgoingUserName },
            newValues: { role: dto.role, incomingUserId: dto.incomingUserId, incomingUserName, reason: dto.reason },
        });
        return {
            engagementId: dto.engagementId,
            role: dto.role,
            outgoingUserId: resolvedOutgoingId,
            outgoingUserName: outgoingUser ? outgoingUserName : null,
            incomingUserId: dto.incomingUserId,
            incomingUserName,
            reason: dto.reason,
        };
    }
    async removeAssignment(assignmentId, removedBy) {
        (0, workflow_utility_1.assertHasPermission)(removedBy.permissions, 'assignment:delete');
        const assignment = await prisma_client_1.prisma.workflow_Assignment.findUnique({
            where: { id: assignmentId },
            include: {
                user: { select: { id: true, email: true } },
                engagement: { select: { id: true, title: true, status: true } },
            },
        });
        if (!assignment)
            throw app_error_1.AppError.notFound('Workflow assignment');
        if (assignment.engagement.status === 'closed') {
            throw app_error_1.AppError.badRequest('Cannot change the team of a closed engagement');
        }
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
    /**
     * Assignments the actor can see and manage: oversight (engagement:read_all)
     * sees every assignment; otherwise assignments on engagements the actor leads,
     * manages, or is assigned to. This is the management view behind the
     * Assignments page — distinct from `getMyAssignments`, which is the actor's
     * own personal assignments only. Without this, a manager who assigns staff
     * could never see the assignments they created.
     */
    async getVisibleAssignments(actor) {
        const isOversight = actor.permissions.includes('engagement:read_all');
        const where = {
            engagement: {
                deleted_at: null,
                ...(isOversight
                    ? {}
                    : {
                        OR: [
                            { lead_auditor_id: actor.id },
                            { audit_manager_id: actor.id },
                            { workflow_assignments: { some: { user_id: actor.id } } },
                        ],
                    }),
            },
        };
        const assignments = await prisma_client_1.prisma.workflow_Assignment.findMany({
            where,
            include: assignmentInclude,
            orderBy: { assigned_at: 'desc' },
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
    async getCandidates(engagementId, actor, opts) {
        (0, workflow_utility_1.assertHasPermission)(actor.permissions, 'assignment:create');
        // Need the engagement's audit type + priority to score skill fit and weight workload.
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { id: true, audit_type: true, priority: true, lead_auditor_id: true, audit_manager_id: true, auditee_id: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        const search = opts?.search?.trim();
        const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
        // Already-assigned users are excluded at the DB so `take` returns a full page.
        const existingAssignments = await prisma_client_1.prisma.workflow_Assignment.findMany({
            where: { engagement_id: engagementId },
            select: { user_id: true },
        });
        // The engagement's own lead / manager / auditee never appear as team candidates.
        const assignedIds = [
            ...existingAssignments.map(a => a.user_id),
            ...[engagement.lead_auditor_id, engagement.audit_manager_id, engagement.auditee_id].filter((id) => Boolean(id)),
        ];
        // ponytail: skill ranking is over the loaded page (search filter + `take: limit`),
        // not the whole directory — `skills` is JSON we can't rank in SQL, and loading every
        // AD-synced user on each picker open was the slow path. Type a name to find anyone.
        const userWhere = {
            deleted_at: null,
            is_active: true,
            // Platform administrators hold every permission but are not audit staff.
            is_super_admin: false,
            id: { notIn: assignedIds },
            // Only audit staff can be assigned to the audit team — the auditee, CAE,
            // directors, committee and viewers participate in other ways.
            user_roles: { some: { role: auditStaffRoleFilter } },
            ...(search
                ? {
                    OR: [
                        { display_name: { contains: search } },
                        { first_name: { contains: search } },
                        { last_name: { contains: search } },
                        { email: { contains: search } },
                        { department: { contains: search } },
                    ],
                }
                : {}),
        };
        // Candidate page + org-wide active-workload counts run in parallel.
        const [users, activeAssignments] = await Promise.all([
            prisma_client_1.prisma.user.findMany({
                where: userWhere,
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
                orderBy: [{ display_name: 'asc' }, { created_at: 'asc' }],
                take: limit,
            }),
            prisma_client_1.prisma.workflow_Assignment.groupBy({
                by: ['user_id'],
                where: {
                    engagement: {
                        status: { in: assignment_matching_util_1.ACTIVE_ENGAGEMENT_STATUSES },
                        deleted_at: null,
                    },
                },
                _count: { user_id: true },
            }),
        ]);
        const workloadMap = new Map(activeAssignments.map(a => [a.user_id, a._count.user_id]));
        return users
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