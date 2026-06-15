"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const finding_response_dto_1 = require("../../dto/response/finding.response.dto");
const findingInclude = {
    engagement: { select: { reference_number: true } },
    checklist: { select: { control_reference: true, control_description: true } },
    risk: { select: { title: true } },
    auditee: { select: { display_name: true, first_name: true, last_name: true, email: true } },
    created_by: { select: { display_name: true, first_name: true, last_name: true, email: true } },
};
class FindingService {
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
        const finding = await prisma_client_1.prisma.audit_Finding.create({
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
        const updated = await prisma_client_1.prisma.audit_Finding.update({
            where: { id },
            data: {
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
            },
            include: findingInclude,
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
        const updated = await prisma_client_1.prisma.audit_Finding.update({
            where: { id },
            data: { status: audit_enum_1.FindingStatus.Closed, closed_by_id: actor.id, closed_at: new Date() },
        });
        logger_util_1.logger.info('Audit finding closed', { findingId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.close', module: 'audit', entityType: 'audit_finding', entityId: id });
        return (0, finding_response_dto_1.mapFindingToResponse)(updated);
    }
    async getFindingById(id, actor) {
        const isAuditee = !actor.permissions.includes('engagement:read');
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({
            where: {
                id,
                deleted_at: null,
                ...(isAuditee && { auditee_id: actor.id }),
            },
            include: {
                ...findingInclude,
                evidence: true,
                follow_up: { include: { remediation_evidence: true } },
            },
        });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
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
        const isOversight = actor.permissions.includes('finding:read_all');
        const isAuditee = !actor.permissions.includes('engagement:read');
        return {
            deleted_at: null,
            ...(query.severity && { severity: query.severity }),
            ...(query.status && { status: query.status }),
            ...(query.category && { category: query.category }),
            ...(query.controlReference && {
                checklist: { control_reference: { contains: query.controlReference } },
            }),
            ...(query.auditeeId && { auditee_id: query.auditeeId }),
            ...(query.search && {
                OR: [
                    { title: { contains: query.search } },
                    { description: { contains: query.search } },
                    { recommendation: { contains: query.search } },
                ],
            }),
            ...(isAuditee && { auditee_id: actor.id }),
            ...(!isOversight && !isAuditee && {
                engagement: {
                    OR: [
                        { lead_auditor_id: actor.id },
                        { workflow_assignments: { some: { user_id: actor.id } } },
                    ],
                },
            }),
        };
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