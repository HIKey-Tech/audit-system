"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const approval_service_1 = require("../../../../workflow/approval/service/implementation/approval.service");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const engagement_visibility_util_1 = require("../../../engagement/utility/engagement-visibility.util");
const finding_response_dto_1 = require("../../dto/response/finding.response.dto");
const findingInclude = {
    engagement: { select: { reference_number: true } },
    checklist: { select: { control_reference: true, control_description: true } },
    risk: { select: { title: true } },
    auditee: { select: { display_name: true, first_name: true, last_name: true, email: true } },
    created_by: { select: { display_name: true, first_name: true, last_name: true, email: true } },
    responders: {
        select: {
            user_id: true,
            user: { select: { display_name: true, first_name: true, last_name: true, email: true } },
        },
    },
};
class FindingService {
    approvalService;
    constructor(approvalService = approval_service_1.workflowApprovalService) {
        this.approvalService = approvalService;
    }
    async createFinding(engagementId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'finding:create');
        await this._assertEngagementAllowsFindings(engagementId);
        if (dto.workingPaperId) {
            await this._assertWorkingPaperInEngagement(dto.workingPaperId, engagementId);
        }
        if (dto.checklistId) {
            await this._assertChecklistInEngagement(dto.checklistId, engagementId);
        }
        if (dto.riskId) {
            await this._assertRiskExists(dto.riskId);
        }
        // Transactional outbox: the finding and the auditee's "new finding" alert
        // commit together. Without this the auditee would only learn of the finding
        // via the daily overdue sweep.
        const finding = await prisma_client_1.prisma.$transaction(async (tx) => {
            const created = await tx.audit_Finding.create({
                data: {
                    engagement_id: engagementId,
                    working_paper_id: dto.workingPaperId,
                    checklist_id: dto.checklistId,
                    risk_id: dto.riskId,
                    title: dto.title,
                    description: dto.description,
                    category: dto.category,
                    severity: dto.severity,
                    root_cause: dto.rootCause,
                    risk_implication: dto.riskImplication,
                    recommendation: dto.recommendation,
                    auditee_id: dto.auditeeId,
                    due_date: new Date(dto.dueDate),
                    created_by_id: actor.id,
                },
                include: findingInclude,
            });
            const dueDate = created.due_date.toISOString();
            const auditeeName = created.auditee.display_name ?? `${created.auditee.first_name} ${created.auditee.last_name}`.trim();
            const findingVariables = {
                auditeeName,
                findingTitle: created.title,
                engagementReference: created.engagement.reference_number,
                severity: created.severity,
                dueDate,
            };
            await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
                userId: created.auditee_id,
                title: 'New audit finding assigned',
                body: `Finding "${created.title}" (${created.engagement.reference_number}) has been raised and assigned to you. Due ${dueDate}.`,
                type: 'warning',
                referenceType: 'audit_finding',
                referenceId: created.id,
                eventKey: 'audit.finding.assigned',
                variables: findingVariables,
            }, { tx });
            await notification_queue_service_1.notificationQueueService.enqueue('email', {
                to: created.auditee.email,
                subject: `New Audit Finding: ${created.title}`,
                text: `Finding "${created.title}" (${created.engagement.reference_number}) has been raised and assigned to you. Due ${dueDate}.`,
                eventKey: 'audit.finding.assigned',
                variables: findingVariables,
            }, { tx });
            // Co-responders: persist the join rows and alert each one, same as the
            // primary auditee, so a finding can be owned by several people.
            const extraIds = [...new Set(dto.additionalAuditeeIds ?? [])].filter((uid) => uid !== created.auditee_id);
            for (const uid of extraIds) {
                const responder = await tx.audit_Finding_Responder.create({
                    data: { finding_id: created.id, user_id: uid },
                    include: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } },
                });
                const responderName = responder.user.display_name ?? `${responder.user.first_name} ${responder.user.last_name}`.trim();
                const responderVariables = { ...findingVariables, auditeeName: responderName };
                await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
                    userId: uid,
                    title: 'New audit finding assigned',
                    body: `Finding "${created.title}" (${created.engagement.reference_number}) has been raised and assigned to you. Due ${dueDate}.`,
                    type: 'warning',
                    referenceType: 'audit_finding',
                    referenceId: created.id,
                    eventKey: 'audit.finding.assigned',
                    variables: responderVariables,
                }, { tx });
                await notification_queue_service_1.notificationQueueService.enqueue('email', {
                    to: responder.user.email,
                    subject: `New Audit Finding: ${created.title}`,
                    text: `Finding "${created.title}" (${created.engagement.reference_number}) has been raised and assigned to you. Due ${dueDate}.`,
                    eventKey: 'audit.finding.assigned',
                    variables: responderVariables,
                }, { tx });
            }
            return created;
        });
        logger_util_1.logger.info('Audit finding created', { findingId: finding.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.create', module: 'audit', entityType: 'audit_finding', entityId: finding.id });
        return (0, finding_response_dto_1.mapFindingToResponse)(finding);
    }
    async updateFinding(id, dto, actor) {
        const finding = await this._getFinding(id);
        const canOverrideOwnership = actor.permissions.includes('finding:read_all');
        if (finding.created_by_id !== actor.id && !canOverrideOwnership)
            throw app_error_1.AppError.forbidden('Only the creator or an audit manager can update this finding');
        if (finding.status === audit_enum_1.FindingStatus.Closed)
            throw app_error_1.AppError.badRequest('Closed findings cannot be updated');
        if (dto.workingPaperId) {
            await this._assertWorkingPaperInEngagement(dto.workingPaperId, finding.engagement_id);
        }
        if (dto.checklistId) {
            await this._assertChecklistInEngagement(dto.checklistId, finding.engagement_id);
        }
        if (dto.riskId) {
            await this._assertRiskExists(dto.riskId);
        }
        const findingData = {
            ...(dto.workingPaperId !== undefined && { working_paper_id: dto.workingPaperId }),
            ...(dto.checklistId !== undefined && { checklist_id: dto.checklistId }),
            ...(dto.riskId !== undefined && { risk_id: dto.riskId }),
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.category !== undefined && { category: dto.category }),
            ...(dto.severity !== undefined && { severity: dto.severity }),
            ...(dto.rootCause !== undefined && { root_cause: dto.rootCause }),
            ...(dto.riskImplication !== undefined && { risk_implication: dto.riskImplication }),
            ...(dto.recommendation !== undefined && { recommendation: dto.recommendation }),
            ...(dto.auditeeId !== undefined && { auditee_id: dto.auditeeId }),
            ...(dto.dueDate !== undefined && { due_date: new Date(dto.dueDate) }),
        };
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            const result = await tx.audit_Finding.update({ where: { id }, data: findingData, include: findingInclude });
            // Co-responders are replaced wholesale when the caller sends the array.
            if (dto.additionalAuditeeIds !== undefined) {
                const primaryId = dto.auditeeId ?? finding.auditee_id;
                const extraIds = [...new Set(dto.additionalAuditeeIds)].filter((uid) => uid !== primaryId);
                await tx.audit_Finding_Responder.deleteMany({ where: { finding_id: id } });
                if (extraIds.length > 0) {
                    await tx.audit_Finding_Responder.createMany({
                        data: extraIds.map((uid) => ({ finding_id: id, user_id: uid })),
                    });
                }
                return tx.audit_Finding.findUniqueOrThrow({ where: { id }, include: findingInclude });
            }
            return result;
        });
        logger_util_1.logger.info('Audit finding updated', { findingId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.update', module: 'audit', entityType: 'audit_finding', entityId: id });
        return (0, finding_response_dto_1.mapFindingToResponse)(updated);
    }
    async updateFindingStatus(id, newStatus, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'finding:update');
        const finding = await this._getFinding(id);
        (0, audit_utility_1.assertTransition)(finding.status, newStatus, audit_utility_1.FINDING_TRANSITIONS, 'finding');
        const updated = await prisma_client_1.prisma.audit_Finding.update({
            where: { id },
            data: { status: newStatus },
        });
        logger_util_1.logger.info('Audit finding status updated', { findingId: id, status: newStatus, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.status.update', module: 'audit', entityType: 'audit_finding', entityId: id, newValues: { status: newStatus } });
        return (0, finding_response_dto_1.mapFindingToResponse)(updated);
    }
    async closeFinding(id, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'finding:close');
        const finding = await this._getFinding(id);
        if (finding.status !== audit_enum_1.FindingStatus.Verified)
            throw app_error_1.AppError.badRequest('Only verified findings can be closed');
        const { updated, approval } = await prisma_client_1.prisma.$transaction(async (tx) => {
            const updated = await tx.audit_Finding.update({
                where: { id },
                data: {
                    status: audit_enum_1.FindingStatus.PendingClosure,
                    closed_by_id: null,
                    closed_at: null,
                },
                include: findingInclude,
            });
            const approval = await this.approvalService.createApproval({
                entityType: workflow_enum_1.WorkflowEntityType.AuditFindingClosure,
                entityId: id,
            }, actor, tx);
            return { updated, approval };
        }, { timeout: 15000 });
        this.approvalService.queueApprovalRequiredNotification(approval);
        logger_util_1.logger.info('Audit finding closure requested', { findingId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.close.request', module: 'audit', entityType: 'audit_finding', entityId: id });
        return (0, finding_response_dto_1.mapFindingToResponse)(updated);
    }
    async getFindingById(id, actor) {
        const isAuditee = (0, audit_utility_1.isFindingAuditee)(actor.permissions);
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({
            where: {
                id,
                deleted_at: null,
                ...(isAuditee && this._auditeeMatch(actor.id)),
            },
            include: {
                ...findingInclude,
                evidence: true,
                follow_up: { include: { remediation_evidence: true } },
            },
        });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
        if (!isAuditee && !actor.permissions.includes('finding:read_all')) {
            const allowed = await prisma_client_1.prisma.audit_Engagement.count({
                where: {
                    id: finding.engagement_id,
                    deleted_at: null,
                    OR: [
                        { lead_auditor_id: actor.id },
                        { audit_manager_id: actor.id },
                        { workflow_assignments: { some: { user_id: actor.id } } },
                    ],
                },
            }) > 0;
            if (!allowed)
                throw app_error_1.AppError.notFound('Audit finding');
        }
        return (0, finding_response_dto_1.mapFindingToResponse)(finding);
    }
    async listAllFindings(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = this._buildFindingWhere(query, actor);
        const [total, findings] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Finding.count({ where }),
            prisma_client_1.prisma.audit_Finding.findMany({
                where,
                include: findingInclude,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            findings: findings.map(finding_response_dto_1.mapFindingToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async listFindings(engagementId, query, actor) {
        const eng = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { status: true, lead_auditor_id: true, audit_manager_id: true, auditee_id: true },
        });
        if (!eng)
            throw app_error_1.AppError.notFound('Audit engagement');
        const viewer = await (0, engagement_visibility_util_1.resolveViewerContext)(engagementId, eng, actor);
        // A pure auditee only sees findings once the report has been issued
        // (engagement is reported/closed); before that, findings are still draft/internal.
        const reportIssued = eng.status === audit_enum_1.EngagementStatus.Reported || eng.status === audit_enum_1.EngagementStatus.Closed;
        if (viewer.role === 'auditee' && !reportIssued) {
            return [];
        }
        const findings = await prisma_client_1.prisma.audit_Finding.findMany({
            where: {
                ...this._buildFindingWhere(query, actor),
                engagement_id: engagementId,
            },
            include: findingInclude,
            orderBy: { created_at: 'desc' },
        });
        return findings.map(finding_response_dto_1.mapFindingToResponse);
    }
    _buildFindingWhere(query, actor) {
        const isOversight = (0, audit_utility_1.isFindingOversight)(actor.permissions);
        const isAuditee = (0, audit_utility_1.isFindingAuditee)(actor.permissions);
        // OR-based clauses are collected into AND so they never overwrite each other.
        const and = [];
        if (query.auditeeId) {
            and.push(this._auditeeMatch(query.auditeeId));
        }
        if (query.search) {
            and.push({
                OR: [
                    { title: { contains: query.search } },
                    { description: { contains: query.search } },
                    { recommendation: { contains: query.search } },
                ],
            });
        }
        if (isAuditee) {
            // A responder sees a finding whether they are the primary auditee or a co-responder.
            and.push(this._auditeeMatch(actor.id));
        }
        else if (!isOversight) {
            and.push({
                engagement: {
                    OR: [
                        { lead_auditor_id: actor.id },
                        { workflow_assignments: { some: { user_id: actor.id } } },
                    ],
                },
            });
        }
        return {
            deleted_at: null,
            ...(query.severity && { severity: query.severity }),
            ...(query.status && { status: query.status }),
            ...(query.category && { category: query.category }),
            ...(query.riskId && { risk_id: query.riskId }),
            ...(query.universeId && { engagement: { universe_id: query.universeId } }),
            ...(query.controlReference && {
                checklist: { control_reference: { contains: query.controlReference } },
            }),
            ...(and.length > 0 && { AND: and }),
        };
    }
    /** Matches findings where the given user is the primary auditee or a co-responder. */
    _auditeeMatch(userId) {
        return { OR: [{ auditee_id: userId }, { responders: { some: { user_id: userId } } }] };
    }
    async _assertEngagementAllowsFindings(engagementId) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { status: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (![audit_enum_1.EngagementStatus.InProgress, audit_enum_1.EngagementStatus.UnderReview].includes(engagement.status)) {
            throw app_error_1.AppError.badRequest('Findings can only be created while an engagement is in progress or under review');
        }
    }
    async _assertWorkingPaperInEngagement(workingPaperId, engagementId) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id: workingPaperId, engagement_id: engagementId, deleted_at: null },
            select: { id: true },
        });
        if (!paper)
            throw app_error_1.AppError.badRequest('Working paper does not belong to this engagement');
    }
    async _assertChecklistInEngagement(checklistId, engagementId) {
        const checklist = await prisma_client_1.prisma.audit_Checklist.findFirst({
            where: { id: checklistId, engagement_id: engagementId },
            select: { id: true },
        });
        if (!checklist)
            throw app_error_1.AppError.badRequest('Checklist item does not belong to this engagement');
    }
    async _assertRiskExists(riskId) {
        const risk = await prisma_client_1.prisma.risk_Register.findFirst({
            where: { id: riskId, deleted_at: null },
            select: { id: true },
        });
        if (!risk)
            throw app_error_1.AppError.badRequest('Risk does not exist');
    }
    async _getFinding(id) {
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({ where: { id, deleted_at: null } });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
        return finding;
    }
}
exports.FindingService = FindingService;
//# sourceMappingURL=finding.service.js.map