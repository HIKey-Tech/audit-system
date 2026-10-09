"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const tabular_export_util_1 = require("../../../../../shared/utils/tabular-export.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
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
                // An auditee only sees findings once the report is issued (engagement reported/closed),
                // matching the list endpoints.
                ...(isAuditee && {
                    AND: [
                        this._auditeeMatch(actor.id),
                        { engagement: { status: { in: [audit_enum_1.EngagementStatus.Reported, audit_enum_1.EngagementStatus.Closed] } } },
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
            // A responder sees a finding whether they are the primary auditee or a co-responder,
            // but — exactly like the engagement Findings tab — only once the engagement's report
            // has been issued (reported/closed). Before that, findings are draft/internal, so this
            // gate stops the standalone Findings page leaking pre-issue findings to the auditee.
            and.push(this._auditeeMatch(actor.id));
            and.push({
                engagement: { status: { in: [audit_enum_1.EngagementStatus.Reported, audit_enum_1.EngagementStatus.Closed] } },
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
}
exports.FindingService = FindingService;
//# sourceMappingURL=finding.service.js.map