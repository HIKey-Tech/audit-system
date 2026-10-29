"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingService = void 0;
const crypto_1 = require("crypto");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_config_1 = require("../../../../../shared/config/app.config");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const tabular_export_util_1 = require("../../../../../shared/utils/tabular-export.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const approval_service_1 = require("../../../../workflow/approval/service/implementation/approval.service");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const auditee_role_utility_1 = require("../../../utility/auditee-role.utility");
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
        // Findings stay internal until the report is issued, so no auditee alert is sent here:
        // ReportService.issueReport notifies every responder once the report goes out.
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
            // Co-responders: persist the join rows so a finding can be owned by several people.
            const extraIds = [...new Set(dto.additionalAuditeeIds ?? [])].filter((uid) => uid !== created.auditee_id);
            if (extraIds.length > 0) {
                await tx.audit_Finding_Responder.createMany({
                    data: extraIds.map((uid) => ({ finding_id: created.id, user_id: uid })),
                });
            }
            return created;
        });
        await (0, auditee_role_utility_1.ensureAuditeeRoleAssigned)([dto.auditeeId, ...(dto.additionalAuditeeIds ?? [])], actor.id);
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
        if (dto.auditeeId || dto.additionalAuditeeIds !== undefined) {
            await (0, auditee_role_utility_1.ensureAuditeeRoleAssigned)([dto.auditeeId, ...(dto.additionalAuditeeIds ?? [])], actor.id);
        }
        logger_util_1.logger.info('Audit finding updated', { findingId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.finding.update',
            module: 'audit',
            entityType: 'audit_finding',
            entityId: id,
            oldValues: {
                title: finding.title, category: finding.category, severity: finding.severity,
                rootCause: finding.root_cause, riskImplication: finding.risk_implication,
                recommendation: finding.recommendation, auditeeId: finding.auditee_id,
                dueDate: finding.due_date,
            },
            newValues: {
                title: updated.title, category: updated.category, severity: updated.severity,
                rootCause: updated.root_cause, riskImplication: updated.risk_implication,
                recommendation: updated.recommendation, auditeeId: updated.auditee_id,
                dueDate: updated.due_date,
            },
        });
        return (0, finding_response_dto_1.mapFindingToResponse)(updated);
    }
    async updateFindingStatus(id, newStatus, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'finding:update');
        const finding = await this._getFinding(id);
        (0, audit_utility_1.assertTransition)(finding.status, newStatus, audit_utility_1.FINDING_TRANSITIONS, 'finding');
        // Each stage is normally reached by the work itself (response, evidence, verification), so a
        // manual change may only record a stage whose proof already exists.
        if (newStatus === audit_enum_1.FindingStatus.Verified) {
            throw app_error_1.AppError.badRequest('A finding can only be verified through the Verify action, which records verification notes');
        }
        const followUp = await prisma_client_1.prisma.audit_Follow_Up.findUnique({
            where: { finding_id: id },
            select: { management_response: true, remediation_evidence_id: true },
        });
        if (newStatus === audit_enum_1.FindingStatus.ManagementResponseReceived && !followUp?.management_response) {
            throw app_error_1.AppError.badRequest('A management response must be recorded before the finding can move to this stage');
        }
        if (newStatus === audit_enum_1.FindingStatus.InRemediation && !followUp?.remediation_evidence_id) {
            throw app_error_1.AppError.badRequest('Remediation evidence must be submitted before the finding can move to this stage');
        }
        const updated = await prisma_client_1.prisma.audit_Finding.update({
            where: { id },
            data: { status: newStatus },
        });
        logger_util_1.logger.info('Audit finding status updated', { findingId: id, status: newStatus, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.status.update', module: 'audit', entityType: 'audit_finding', entityId: id, oldValues: { status: finding.status }, newValues: { status: newStatus } });
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
                // An auditee sees findings from Quality Assurance onward (fieldwork done), so they can
                // respond before the report is issued — matching the list endpoints.
                ...(isAuditee && {
                    AND: [
                        this._auditeeMatch(actor.id),
                        { engagement: { status: { in: [...audit_enum_1.AUDITEE_VISIBLE_ENGAGEMENT_STATUSES] } } },
                    ],
                }),
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
    async exportFindings(query, format, actor) {
        const findings = await prisma_client_1.prisma.audit_Finding.findMany({
            where: this._buildFindingWhere(query, actor),
            include: findingInclude,
            orderBy: { [query.sortBy]: query.sortOrder },
            take: tabular_export_util_1.EXPORT_MAX_ROWS,
        });
        const rows = findings.map(finding_response_dto_1.mapFindingToResponse);
        logger_util_1.logger.info('Findings register exported', { actorId: actor.id, format, count: rows.length });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.finding.export',
            module: 'audit',
            entityType: 'audit_finding',
            newValues: { format, count: rows.length, filters: query },
        });
        return (0, tabular_export_util_1.buildTabularExport)(rows, [
            { header: 'Engagement', value: (f) => f.engagementReference },
            { header: 'Title', value: (f) => f.title },
            { header: 'Severity', value: (f) => f.severity },
            { header: 'Status', value: (f) => f.status },
            { header: 'Category', value: (f) => f.category },
            { header: 'Control reference', value: (f) => f.controlReference },
            { header: 'Linked risk', value: (f) => f.riskTitle },
            { header: 'Description', value: (f) => f.description },
            { header: 'Root cause', value: (f) => f.rootCause },
            { header: 'Risk implication', value: (f) => f.riskImplication },
            { header: 'Recommendation', value: (f) => f.recommendation },
            { header: 'Auditee', value: (f) => f.auditeeName },
            { header: 'Due date', value: (f) => f.dueDate },
            { header: 'Raised by', value: (f) => f.createdByName },
            { header: 'Raised on', value: (f) => f.createdAt },
            { header: 'Closed on', value: (f) => f.closedAt },
        ], { baseName: 'findings-register', format, sheetName: 'Findings' });
    }
    async listFindings(engagementId, query, actor) {
        const eng = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { status: true, lead_auditor_id: true, audit_manager_id: true, auditee_id: true },
        });
        if (!eng)
            throw app_error_1.AppError.notFound('Audit engagement');
        const viewer = await (0, engagement_visibility_util_1.resolveViewerContext)(engagementId, eng, actor);
        // A pure auditee sees findings from Quality Assurance onward; during fieldwork
        // (planned / in progress) findings are still being drafted and stay internal.
        const visibleToAuditee = audit_enum_1.AUDITEE_VISIBLE_ENGAGEMENT_STATUSES.includes(eng.status);
        if (viewer.role === 'auditee' && !visibleToAuditee) {
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
            // A responder sees a finding whether they are the primary auditee or a co-responder,
            // but — exactly like the engagement Findings tab — only from Quality Assurance onward.
            // During fieldwork findings are draft/internal, so this gate stops the standalone
            // Findings page leaking them to the auditee.
            and.push(this._auditeeMatch(actor.id));
            and.push({
                engagement: { status: { in: [...audit_enum_1.AUDITEE_VISIBLE_ENGAGEMENT_STATUSES] } },
            });
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
    async listComments(findingId, actor) {
        await this.getFindingById(findingId, actor);
        const key = `finding.comments.${findingId}`;
        const row = await prisma_client_1.prisma.system_Config.findUnique({ where: { key }, select: { value: true } });
        if (!row?.value)
            return [];
        try {
            const parsed = JSON.parse(row.value);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    async addComment(findingId, body, actor) {
        const trimmed = body?.trim();
        if (!trimmed)
            throw app_error_1.AppError.badRequest('Comment body cannot be empty');
        // Verify viewer access to this finding
        await this.getFindingById(findingId, actor);
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({
            where: { id: findingId, deleted_at: null },
            include: {
                engagement: {
                    select: {
                        id: true,
                        title: true,
                        reference_number: true,
                        status: true,
                        lead_auditor_id: true,
                        audit_manager_id: true,
                        auditee_id: true,
                    },
                },
                responders: { select: { user_id: true } },
            },
        });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
        const author = await prisma_client_1.prisma.user.findUnique({
            where: { id: actor.id },
            select: { id: true, display_name: true, first_name: true, last_name: true, email: true },
        });
        const authorName = author?.display_name?.trim() ||
            `${author?.first_name ?? ''} ${author?.last_name ?? ''}`.trim() ||
            author?.email ||
            'User';
        const isAuditeeParty = actor.id === finding.auditee_id ||
            actor.id === finding.engagement.auditee_id ||
            finding.responders.some((r) => r.user_id === actor.id);
        const authorRole = isAuditeeParty ? 'Auditee' : 'Audit Team';
        const existing = await this.listComments(findingId, actor);
        const newComment = {
            id: (0, crypto_1.randomUUID)(),
            findingId,
            authorId: actor.id,
            authorName,
            authorRole,
            body: trimmed,
            createdAt: new Date().toISOString(),
        };
        const updated = [...existing, newComment];
        const key = `finding.comments.${findingId}`;
        await prisma_client_1.prisma.system_Config.upsert({
            where: { key },
            update: { value: JSON.stringify(updated), updated_by_id: actor.id },
            create: {
                key,
                value: JSON.stringify(updated),
                description: `Discussion trail for finding ${findingId}`,
                updated_by_id: actor.id,
            },
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.finding.comment',
            module: 'audit',
            entityType: 'audit_finding',
            entityId: findingId,
            newValues: { commentId: newComment.id, body: trimmed.slice(0, 300) },
        });
        // Notify both sides: finding creator, lead auditor, audit manager, primary auditee,
        // co-responders, and previous commenters (excluding the comment author).
        // Auditees are only notified once the engagement is visible to auditees.
        const auditeeVisible = audit_enum_1.AUDITEE_VISIBLE_ENGAGEMENT_STATUSES.includes(finding.engagement.status);
        const candidateIds = new Set([
            finding.created_by_id,
            finding.engagement.lead_auditor_id,
            finding.engagement.audit_manager_id,
            ...existing.map((c) => c.authorId),
            ...(auditeeVisible
                ? [
                    finding.auditee_id,
                    finding.engagement.auditee_id,
                    ...finding.responders.map((r) => r.user_id),
                ]
                : []),
        ]);
        candidateIds.delete(actor.id);
        if (candidateIds.size > 0) {
            const recipients = await prisma_client_1.prisma.user.findMany({
                where: { id: { in: Array.from(candidateIds) }, deleted_at: null, is_active: true },
                select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
            });
            const actionUrl = `${app_config_1.config.app.frontendUrl.replace(/\/$/, '')}/audit/engagements/${finding.engagement_id}?tab=findings`;
            for (const r of recipients) {
                const recipientName = r.display_name?.trim() || `${r.first_name} ${r.last_name}`.trim() || r.email;
                const variables = {
                    recipientName,
                    authorName,
                    authorRole,
                    findingTitle: finding.title,
                    engagementReference: finding.engagement.reference_number,
                    engagementTitle: finding.engagement.title,
                    commentBody: trimmed.slice(0, 400),
                    actionUrl,
                };
                await notification_queue_service_1.notificationQueueService.enqueueSafe('in_app', {
                    userId: r.id,
                    title: `New comment on finding: ${finding.title}`,
                    body: `${authorName} (${authorRole}) commented on "${finding.title}": ${trimmed.slice(0, 200)}`,
                    type: 'info',
                    referenceType: 'audit_engagement',
                    referenceId: finding.engagement_id,
                    eventKey: 'audit.finding.commented',
                    variables,
                });
                if (r.email) {
                    await notification_queue_service_1.notificationQueueService.enqueueSafe('email', {
                        to: r.email,
                        subject: `New Comment on Finding (${finding.engagement.reference_number}): ${finding.title}`,
                        text: `Dear ${recipientName},\n\n${authorName} (${authorRole}) left a comment on audit finding "${finding.title}" (${finding.engagement.reference_number}).\n\nComment:\n"${trimmed}"\n\nPlease log in to IAMS to view the discussion trail and respond.\n\nRegards,\nIAMS — Internal Audit System`,
                        eventKey: 'audit.finding.commented',
                        variables,
                    });
                }
            }
        }
        return newComment;
    }
}
exports.FindingService = FindingService;
//# sourceMappingURL=finding.service.js.map