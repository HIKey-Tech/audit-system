"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const audit_config_utility_1 = require("../../../utility/audit-config.utility");
const engagement_gates_1 = require("./engagement-gates");
const engagement_visibility_util_1 = require("../../utility/engagement-visibility.util");
const approval_service_1 = require("../../../../workflow/approval/service/implementation/approval.service");
const assignment_matching_util_1 = require("../../../../workflow/assignment/utility/assignment-matching.util");
const engagement_response_dto_1 = require("../../dto/response/engagement.response.dto");
/**
 * Permissions an engagement's audit manager must hold: they are the pinned
 * approver for the engagement's working papers and the first-level approver for
 * its report, so without these the approval chain would dead-end.
 */
const MANAGER_APPROVAL_PERMISSIONS = ['working_paper:approve', 'report:approve', 'finding:close'];
/**
 * Permission a lead auditor must hold: they run fieldwork on the engagement and
 * author its working papers. This is the minimum "is an auditor" gate — it
 * admits the `auditor`, `audit_lead` and `audit_manager` roles while excluding
 * auditees, viewers and non-audit staff who can't produce working papers.
 */
const LEAD_AUDITOR_PERMISSIONS = ['working_paper:create'];
const userNameSelect = { select: { id: true, first_name: true, last_name: true, display_name: true } };
const engagementInclude = {
    universe: true,
    plan_item: { include: { plan: { select: { id: true, title: true } } } },
    lead_auditor: userNameSelect,
    audit_manager: userNameSelect,
    auditee: userNameSelect,
};
class EngagementService {
    checklistService;
    userService;
    assignmentService;
    approvalService;
    constructor(checklistService, userService, assignmentService, approvalService = approval_service_1.workflowApprovalService) {
        this.checklistService = checklistService;
        this.userService = userService;
        this.assignmentService = assignmentService;
        this.approvalService = approvalService;
    }
    async _assertManagerCanApprove(managerId) {
        const manager = await this.userService.getUserById(managerId);
        if (!manager.isActive)
            throw app_error_1.AppError.badRequest('Assigned audit manager account is deactivated');
        const missing = MANAGER_APPROVAL_PERMISSIONS.filter((slug) => !manager.permissions.includes(slug));
        if (missing.length > 0) {
            throw app_error_1.AppError.badRequest(`Assigned audit manager must hold approval permissions: ${missing.join(', ')}`);
        }
    }
    async _assertLeadAuditorEligible(leadAuditorId) {
        const lead = await this.userService.getUserById(leadAuditorId);
        if (!lead.isActive)
            throw app_error_1.AppError.badRequest('Assigned lead auditor account is deactivated');
        const missing = LEAD_AUDITOR_PERMISSIONS.filter((slug) => !lead.permissions.includes(slug));
        if (missing.length > 0) {
            throw app_error_1.AppError.badRequest(`Assigned lead auditor must hold fieldwork permissions: ${missing.join(', ')}`);
        }
    }
    async _assertUniverseActive(universeId) {
        const universe = await prisma_client_1.prisma.audit_Universe.findFirst({
            where: { id: universeId, deleted_at: null },
            select: { id: true },
        });
        if (!universe)
            throw app_error_1.AppError.badRequest('Universe entity does not exist or has been deleted');
    }
    async _assertAuditeeActive(auditeeId) {
        if (!auditeeId)
            return;
        const auditee = await this.userService.getUserById(auditeeId);
        if (!auditee.isActive)
            throw app_error_1.AppError.badRequest('Assigned auditee account is deactivated');
    }
    async getEligibleUsers(query) {
        const requiredPermissions = query.role === 'audit_manager' ? MANAGER_APPROVAL_PERMISSIONS : LEAD_AUDITOR_PERMISSIONS;
        const userQuery = {
            page: 1,
            pageSize: 100,
            isActive: true,
            sortBy: 'created_at',
            sortOrder: 'desc',
        };
        const [{ users }, workloadMap] = await Promise.all([
            this.userService.listUsers(userQuery),
            this.assignmentService.getActiveWorkloadMap(),
        ]);
        const auditType = query.auditType ?? '';
        const priority = query.priority ?? 'medium';
        return users
            .filter((u) => u.isActive && requiredPermissions.every((p) => u.permissions.includes(p)))
            .map((u) => {
            const activeEngagementCount = workloadMap.get(u.id) ?? 0;
            const matchedSkills = (0, assignment_matching_util_1.getMatchedSkills)(u.skills, auditType);
            const skillScore = (0, assignment_matching_util_1.getSkillScore)(u.skills, auditType);
            const capacity = u.maxConcurrentEngagements ?? assignment_matching_util_1.MAX_CONCURRENT_ENGAGEMENTS;
            const overCapacity = activeEngagementCount >= capacity;
            return {
                id: u.id,
                displayName: u.displayName || `${u.firstName} ${u.lastName}`.trim(),
                department: u.department,
                jobTitle: u.jobTitle,
                skills: u.skills,
                matchedSkills,
                activeEngagementCount,
                recommendationScore: (0, assignment_matching_util_1.getRecommendationScore)(skillScore, activeEngagementCount, priority),
                recommended: skillScore > 0 && !overCapacity,
                overCapacity,
            };
        })
            .sort((a, b) => b.recommendationScore - a.recommendationScore ||
            a.activeEngagementCount - b.activeEngagementCount);
    }
    async createFromPlanItem(planItemId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'engagement:create');
        const planItem = await prisma_client_1.prisma.audit_Plan_Item.findUnique({
            where: { id: planItemId },
            include: { plan: true },
        });
        if (!planItem)
            throw app_error_1.AppError.notFound('Audit plan item');
        if (planItem.plan.status !== audit_enum_1.PlanStatus.Approved)
            throw app_error_1.AppError.badRequest('Plan must be approved before creating an engagement');
        if (planItem.engagement_created)
            throw app_error_1.AppError.conflict('An engagement has already been created from this plan item');
        await this._assertManagerCanApprove(dto.auditManagerId);
        await this._assertLeadAuditorEligible(dto.leadAuditorId);
        await this._assertAuditeeActive(dto.auditeeId);
        const referenceNumber = await this._nextReferenceNumber(new Date(dto.plannedStartDate).getUTCFullYear());
        const engagement = await prisma_client_1.prisma.$transaction(async (tx) => {
            const created = await tx.audit_Engagement.create({
                data: {
                    reference_number: referenceNumber,
                    title: dto.title,
                    universe_id: planItem.universe_id,
                    plan_item_id: planItemId,
                    audit_type: planItem.audit_type,
                    priority: planItem.priority,
                    lead_auditor_id: dto.leadAuditorId,
                    audit_manager_id: dto.auditManagerId,
                    auditee_id: dto.auditeeId,
                    planned_start_date: new Date(dto.plannedStartDate),
                    planned_end_date: new Date(dto.plannedEndDate),
                    sla_deadline: new Date(dto.slaDeadline),
                    planned_hours: dto.plannedHours,
                    checklist_template: (0, audit_config_utility_1.serializeChecklistControls)(dto.checklistControls),
                    created_by_id: actor.id,
                },
                include: engagementInclude,
            });
            await tx.audit_Plan_Item.update({
                where: { id: planItemId },
                data: { engagement_created: true },
            });
            return created;
        });
        logger_util_1.logger.info('Audit engagement created from plan item', { engagementId: engagement.id, planItemId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.create_from_plan', module: 'audit', entityType: 'audit_engagement', entityId: engagement.id });
        return (0, engagement_response_dto_1.mapEngagementToResponse)(engagement);
    }
    async createAdhoc(dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'engagement:create');
        if (!dto.adhocReason)
            throw app_error_1.AppError.badRequest('Ad-hoc reason is required');
        await this._assertUniverseActive(dto.universeId);
        await this._assertManagerCanApprove(dto.auditManagerId);
        await this._assertLeadAuditorEligible(dto.leadAuditorId);
        await this._assertAuditeeActive(dto.auditeeId);
        const referenceNumber = await this._nextReferenceNumber(new Date(dto.plannedStartDate).getUTCFullYear());
        const engagement = await prisma_client_1.prisma.audit_Engagement.create({
            data: {
                reference_number: referenceNumber,
                title: dto.title,
                universe_id: dto.universeId,
                audit_type: dto.auditType,
                priority: dto.priority,
                lead_auditor_id: dto.leadAuditorId,
                audit_manager_id: dto.auditManagerId,
                auditee_id: dto.auditeeId,
                planned_start_date: new Date(dto.plannedStartDate),
                planned_end_date: new Date(dto.plannedEndDate),
                sla_deadline: new Date(dto.slaDeadline),
                planned_hours: dto.plannedHours,
                is_adhoc: true,
                adhoc_reason: dto.adhocReason,
                checklist_template: (0, audit_config_utility_1.serializeChecklistControls)(dto.checklistControls),
                created_by_id: actor.id,
            },
            include: engagementInclude,
        });
        logger_util_1.logger.info('Ad-hoc audit engagement created', { engagementId: engagement.id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.create_adhoc', module: 'audit', entityType: 'audit_engagement', entityId: engagement.id });
        return (0, engagement_response_dto_1.mapEngagementToResponse)(engagement);
    }
    async updateEngagement(id, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'engagement:update');
        const existing = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id, deleted_at: null },
            select: { audit_manager_id: true },
        });
        if (!existing)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (dto.auditManagerId !== undefined)
            await this._assertManagerCanApprove(dto.auditManagerId);
        if (dto.leadAuditorId !== undefined)
            await this._assertLeadAuditorEligible(dto.leadAuditorId);
        const managerChanged = dto.auditManagerId !== undefined && dto.auditManagerId !== existing.audit_manager_id;
        const engagement = await prisma_client_1.prisma.$transaction(async (tx) => {
            const updated = await tx.audit_Engagement.update({
                where: { id },
                data: {
                    ...(dto.title !== undefined && { title: dto.title }),
                    ...(dto.leadAuditorId !== undefined && { lead_auditor_id: dto.leadAuditorId }),
                    ...(dto.auditManagerId !== undefined && { audit_manager_id: dto.auditManagerId }),
                    ...(dto.auditeeId !== undefined && { auditee_id: dto.auditeeId }),
                    ...(dto.plannedStartDate !== undefined && { planned_start_date: new Date(dto.plannedStartDate) }),
                    ...(dto.plannedEndDate !== undefined && { planned_end_date: new Date(dto.plannedEndDate) }),
                    ...(dto.slaDeadline !== undefined && { sla_deadline: new Date(dto.slaDeadline) }),
                    ...(dto.priority !== undefined && { priority: dto.priority }),
                    ...(dto.adhocReason !== undefined && { adhoc_reason: dto.adhocReason }),
                    ...(dto.plannedHours !== undefined && { planned_hours: dto.plannedHours }),
                },
                include: engagementInclude,
            });
            // A pinned engagement-manager approval step has no active-holder fallback
            // (see ApprovalService#_resolveApproverChain) — migrate any already-created
            // pending steps to the new manager so the approval doesn't stall.
            if (managerChanged) {
                await this.approvalService.reassignEngagementManagerApprovals(id, existing.audit_manager_id, dto.auditManagerId, tx);
            }
            return updated;
        });
        logger_util_1.logger.info('Audit engagement updated', { engagementId: id, actorId: actor.id, managerChanged });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.update', module: 'audit', entityType: 'audit_engagement', entityId: id, newValues: (0, engagement_response_dto_1.mapEngagementToResponse)(engagement) });
        return (0, engagement_response_dto_1.mapEngagementToResponse)(engagement);
    }
    async updateStatus(id, newStatus, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'engagement:update');
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id, deleted_at: null },
            include: engagementInclude,
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        (0, audit_utility_1.assertTransition)(engagement.status, newStatus, audit_utility_1.ENGAGEMENT_TRANSITIONS, 'engagement');
        await this._assertLifecycleGate(id, newStatus);
        const lifecycleRules = await (0, audit_config_utility_1.getAuditLifecycleRules)();
        if (newStatus === audit_enum_1.EngagementStatus.Closed && lifecycleRules.requireClosedFindingsBeforeClose) {
            const openFindingCount = await prisma_client_1.prisma.audit_Finding.count({
                where: {
                    engagement_id: id,
                    deleted_at: null,
                    status: { not: audit_enum_1.FindingStatus.Closed },
                },
            });
            if (openFindingCount > 0)
                throw app_error_1.AppError.badRequest('Cannot close engagement while findings remain open or awaiting closure approval');
        }
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            const result = await tx.audit_Engagement.update({
                where: { id },
                data: {
                    status: newStatus,
                    ...(newStatus === audit_enum_1.EngagementStatus.InProgress && { actual_start_date: new Date() }),
                    ...(newStatus === audit_enum_1.EngagementStatus.Closed && { actual_end_date: new Date() }),
                },
                include: engagementInclude,
            });
            if (newStatus === audit_enum_1.EngagementStatus.Closed) {
                await tx.audit_Universe.update({
                    where: { id: engagement.universe_id },
                    data: { last_audited_at: new Date() },
                });
            }
            return result;
        });
        if (newStatus === audit_enum_1.EngagementStatus.InProgress) {
            await this.checklistService.populateChecklists(id, actor.id);
        }
        logger_util_1.logger.info('Audit engagement status updated', { engagementId: id, status: newStatus, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.engagement.status.update', module: 'audit', entityType: 'audit_engagement', entityId: id, newValues: { status: newStatus } });
        return this._withMetrics(updated, actor);
    }
    /**
     * Access scope: unless the actor can read ALL engagements, they may only see
     * engagements they are a party to — lead auditor, audit manager, auditee, or a
     * workflow assignee. Returns undefined for unrestricted (read_all) access.
     */
    _actorScope(actor) {
        if (actor.permissions.includes('engagement:read_all'))
            return undefined;
        return {
            OR: [
                { lead_auditor_id: actor.id },
                { audit_manager_id: actor.id },
                { auditee_id: actor.id },
                { workflow_assignments: { some: { user_id: actor.id } } },
            ],
        };
    }
    /**
     * Active-approver access: a user with a pending approval step they may act on,
     * against one of this engagement's reports / working papers / findings, can open
     * the engagement while that step is open — you can't approve what you can't read.
     */
    async _hasActiveApprovalAccess(engagementId, actor) {
        const [reports, papers, findings] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Report.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
            prisma_client_1.prisma.audit_Working_Paper.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
            prisma_client_1.prisma.audit_Finding.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
        ]);
        const entityIds = [...reports, ...papers, ...findings].map((r) => r.id);
        if (entityIds.length === 0)
            return false;
        const orConditions = [{ approver_id: actor.id }];
        if (actor.permissions.length > 0) {
            orConditions.push({ approver_id: null, required_permission: { in: actor.permissions } });
        }
        const step = await prisma_client_1.prisma.workflow_Approval_Step.findFirst({
            where: {
                status: 'pending',
                approval: { status: 'pending', entity_id: { in: entityIds } },
                OR: orConditions,
            },
            select: { id: true, level: true, approval: { select: { current_level: true } } },
        });
        return step !== null && step.level === step.approval.current_level;
    }
    async getEngagementById(id, actor) {
        const scope = this._actorScope(actor);
        let engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id, deleted_at: null, ...(scope ?? {}) },
            include: engagementInclude,
        });
        // Not an involved party / oversight — allow if they hold a live approval step on it.
        if (!engagement && scope && (await this._hasActiveApprovalAccess(id, actor))) {
            engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
                where: { id, deleted_at: null },
                include: engagementInclude,
            });
        }
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        return this._withMetrics(engagement, actor);
    }
    async listEngagements(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const scope = this._actorScope(actor);
        const where = {
            deleted_at: null,
            ...(query.status && { status: query.status }),
            ...(query.auditType && { audit_type: query.auditType }),
            ...(query.leadAuditorId && { lead_auditor_id: query.leadAuditorId }),
            ...(query.auditManagerId && { audit_manager_id: query.auditManagerId }),
            ...(scope ?? {}),
        };
        const [total, engagements] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Engagement.count({ where }),
            prisma_client_1.prisma.audit_Engagement.findMany({
                where,
                include: engagementInclude,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            engagements: engagements.map((engagement) => (0, engagement_response_dto_1.mapEngagementToResponse)(engagement)),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async _nextReferenceNumber(year) {
        const latest = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { reference_number: { startsWith: `AUD-${year}-` } },
            orderBy: { reference_number: 'desc' },
            select: { reference_number: true },
        });
        const sequence = latest ? (0, audit_utility_1.parseReferenceSequence)(latest.reference_number, year) + 1 : 1;
        return (0, audit_utility_1.buildReferenceNumber)(year, sequence);
    }
    async _assertEngagementExists(id) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
    }
    async _withMetrics(engagement, actor) {
        const [findingGroups, workingPaperGroups, checklistProgress, report, evidenceCount, assetCount] = await Promise.all([
            prisma_client_1.prisma.audit_Finding.groupBy({
                by: ['severity'],
                where: { engagement_id: engagement.id, deleted_at: null },
                _count: { _all: true },
            }),
            prisma_client_1.prisma.audit_Working_Paper.groupBy({
                by: ['status'],
                where: { engagement_id: engagement.id, deleted_at: null },
                _count: { _all: true },
            }),
            this.checklistService.getChecklistProgress(engagement.id),
            prisma_client_1.prisma.audit_Report.findFirst({
                where: { engagement_id: engagement.id, deleted_at: null },
                select: { status: true },
            }),
            prisma_client_1.prisma.audit_Evidence.count({ where: { engagement_id: engagement.id } }),
            prisma_client_1.prisma.audit_Engagement_Asset.count({ where: { engagement_id: engagement.id } }),
        ]);
        const loggedTime = await prisma_client_1.prisma.audit_Time_Entry.aggregate({
            where: { engagement_id: engagement.id, deleted_at: null },
            _sum: { hours: true },
        });
        const findingStatusGroups = await prisma_client_1.prisma.audit_Finding.groupBy({
            by: ['status'],
            where: { engagement_id: engagement.id, deleted_at: null },
            _count: { _all: true },
        });
        const findingCounts = findingGroups.map((group) => ({
            severity: group.severity,
            count: group._count._all,
        }));
        const progress = checklistProgress;
        const wpCountByStatus = (status) => workingPaperGroups.find((g) => g.status === status)?._count._all ?? 0;
        const workingPaperCount = workingPaperGroups.reduce((sum, g) => sum + g._count._all, 0);
        const workingPaperStats = {
            total: workingPaperCount,
            approved: wpCountByStatus('approved'),
            rejected: wpCountByStatus('rejected'),
        };
        const findingTotal = findingStatusGroups.reduce((sum, g) => sum + g._count._all, 0);
        const findingCountByStatus = (status) => findingStatusGroups.find((g) => g.status === status)?._count._all ?? 0;
        const resolvedFindings = findingCountByStatus('closed');
        const findingStats = {
            total: findingTotal,
            open: findingCountByStatus('open'),
            unresolved: findingTotal - resolvedFindings,
        };
        const viewerContext = await (0, engagement_visibility_util_1.resolveViewerContext)(engagement.id, {
            lead_auditor_id: engagement.lead_auditor_id,
            audit_manager_id: engagement.audit_manager_id,
            auditee_id: engagement.auditee_id,
        }, actor);
        const gateStatus = await (0, engagement_gates_1.getEngagementGateStatus)(engagement.id, engagement.status);
        const dto = (0, engagement_response_dto_1.mapEngagementToResponse)(engagement, {
            findingCounts,
            workingPaperCount,
            checklistProgress: progress,
            workingPaperStats,
            findingStats,
            reportStatus: report?.status ?? null,
            evidenceCount,
            assetCount,
            actualHours: Number(loggedTime._sum.hours ?? 0),
        });
        dto.viewerContext = viewerContext;
        // Always set when a gate applies to the current status (even as an empty
        // array once satisfied) so the frontend can tell "no blockers" apart from
        // "no forward gate for this status" (planned/closed).
        if (gateStatus)
            dto.pendingGates = gateStatus.unmet;
        return dto;
    }
    async _assertLifecycleGate(id, newStatus) {
        const lifecycleRules = await (0, audit_config_utility_1.getAuditLifecycleRules)();
        if (newStatus === audit_enum_1.EngagementStatus.UnderReview) {
            if (lifecycleRules.requireAllChecklistsTestedBeforeUnderReview) {
                const [totalChecklistCount, notTestedCount] = await prisma_client_1.prisma.$transaction([
                    prisma_client_1.prisma.audit_Checklist.count({ where: { engagement_id: id } }),
                    prisma_client_1.prisma.audit_Checklist.count({
                        where: { engagement_id: id, result: 'not_tested' },
                    }),
                ]);
                if (totalChecklistCount === 0) {
                    throw app_error_1.AppError.badRequest('Cannot move engagement to review before checklist procedures are populated');
                }
                if (notTestedCount > 0) {
                    throw app_error_1.AppError.badRequest('Cannot move engagement to review while checklist procedures remain untested');
                }
            }
            if (lifecycleRules.requireApprovedWorkingPaperBeforeUnderReview) {
                const [totalPaperCount, unapprovedPaperCount] = await prisma_client_1.prisma.$transaction([
                    prisma_client_1.prisma.audit_Working_Paper.count({
                        where: { engagement_id: id, deleted_at: null },
                    }),
                    prisma_client_1.prisma.audit_Working_Paper.count({
                        where: { engagement_id: id, deleted_at: null, status: { not: 'approved' } },
                    }),
                ]);
                if (totalPaperCount === 0) {
                    throw app_error_1.AppError.badRequest('Cannot move engagement to review before at least one working paper is created and approved');
                }
                if (unapprovedPaperCount > 0) {
                    throw app_error_1.AppError.badRequest('Cannot move engagement to review while working papers remain unapproved — all working papers must be approved');
                }
            }
        }
        if (newStatus === audit_enum_1.EngagementStatus.Reported && lifecycleRules.requireReportIssuedBeforeReported) {
            const issuedReportCount = await prisma_client_1.prisma.audit_Report.count({
                where: {
                    engagement_id: id,
                    deleted_at: null,
                    status: 'issued',
                },
            });
            if (issuedReportCount === 0) {
                throw app_error_1.AppError.badRequest('Cannot mark engagement as reported before an audit report is issued');
            }
        }
    }
}
exports.EngagementService = EngagementService;
//# sourceMappingURL=engagement.service.js.map