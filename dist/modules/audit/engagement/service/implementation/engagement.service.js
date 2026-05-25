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
const engagement_response_dto_1 = require("../../dto/response/engagement.response.dto");
const engagementInclude = { universe: true };
class EngagementService {
    checklistService;
    constructor(checklistService) {
        this.checklistService = checklistService;
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
                is_adhoc: true,
                adhoc_reason: dto.adhocReason,
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
        await this._assertEngagementExists(id);
        const engagement = await prisma_client_1.prisma.audit_Engagement.update({
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
            },
            include: engagementInclude,
        });
        logger_util_1.logger.info('Audit engagement updated', { engagementId: id, actorId: actor.id });
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
                    status: { notIn: [audit_enum_1.FindingStatus.Verified, audit_enum_1.FindingStatus.Closed] },
                },
            });
            if (openFindingCount > 0)
                throw app_error_1.AppError.badRequest('Cannot close engagement while findings remain unverified or open');
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
        return this._withMetrics(updated);
    }
    async getEngagementById(id, actor) {
        const isAuditee = !actor.permissions.includes('engagement:read');
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: {
                id,
                deleted_at: null,
                ...(isAuditee && { auditee_id: actor.id }),
            },
            include: engagementInclude,
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        return this._withMetrics(engagement);
    }
    async listEngagements(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const canReadAll = actor.permissions.includes('engagement:read_all');
        const isAuditee = !actor.permissions.includes('engagement:read');
        const where = {
            deleted_at: null,
            ...(query.status && { status: query.status }),
            ...(query.auditType && { audit_type: query.auditType }),
            ...(query.leadAuditorId && { lead_auditor_id: query.leadAuditorId }),
            ...(query.auditManagerId && { audit_manager_id: query.auditManagerId }),
            ...(isAuditee && { auditee_id: actor.id }),
            ...(!canReadAll && !isAuditee && {
                OR: [
                    { lead_auditor_id: actor.id },
                    { workflow_assignments: { some: { user_id: actor.id } } },
                ],
            }),
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
    async _withMetrics(engagement) {
        const [findingGroups, workingPaperCount, checklistProgress] = await Promise.all([
            prisma_client_1.prisma.audit_Finding.groupBy({
                by: ['severity'],
                where: { engagement_id: engagement.id, deleted_at: null },
                _count: { _all: true },
            }),
            prisma_client_1.prisma.audit_Working_Paper.count({ where: { engagement_id: engagement.id, deleted_at: null } }),
            this.checklistService.getChecklistProgress(engagement.id),
        ]);
        const findingCounts = findingGroups.map((group) => ({
            severity: group.severity,
            count: group._count._all,
        }));
        const progress = checklistProgress;
        return (0, engagement_response_dto_1.mapEngagementToResponse)(engagement, {
            findingCounts,
            workingPaperCount,
            checklistProgress: progress,
        });
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
                const approvedPaperCount = await prisma_client_1.prisma.audit_Working_Paper.count({
                    where: {
                        engagement_id: id,
                        deleted_at: null,
                        status: 'approved',
                    },
                });
                if (approvedPaperCount === 0) {
                    throw app_error_1.AppError.badRequest('Cannot move engagement to review before at least one working paper is approved');
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