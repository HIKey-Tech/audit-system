"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const finding_response_dto_1 = require("../../dto/response/finding.response.dto");
class FindingService {
    async createFinding(engagementId, dto, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_WORK_ROLES);
        await this._assertEngagementAllowsFindings(engagementId);
        if (dto.workingPaperId) {
            await this._assertWorkingPaperInEngagement(dto.workingPaperId, engagementId);
        }
        const finding = await prisma_client_1.prisma.audit_Finding.create({
            data: {
                engagement_id: engagementId,
                working_paper_id: dto.workingPaperId,
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
        });
        logger_util_1.logger.info('Audit finding created', { findingId: finding.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.create', module: 'audit', entityType: 'audit_finding', entityId: finding.id });
        return (0, finding_response_dto_1.mapFindingToResponse)(finding);
    }
    async updateFinding(id, dto, actor) {
        const finding = await this._getFinding(id);
        const isAdmin = actor.roles.some((role) => role === 'super_admin' || role === 'audit_admin');
        if (finding.created_by_id !== actor.id && !isAdmin)
            throw app_error_1.AppError.forbidden('Only the creator or audit admin can update this finding');
        if (finding.status === audit_enum_1.FindingStatus.Closed)
            throw app_error_1.AppError.badRequest('Closed findings cannot be updated');
        if (dto.workingPaperId) {
            await this._assertWorkingPaperInEngagement(dto.workingPaperId, finding.engagement_id);
        }
        const updated = await prisma_client_1.prisma.audit_Finding.update({
            where: { id },
            data: {
                ...(dto.workingPaperId !== undefined && { working_paper_id: dto.workingPaperId }),
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
        });
        logger_util_1.logger.info('Audit finding updated', { findingId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.finding.update', module: 'audit', entityType: 'audit_finding', entityId: id });
        return (0, finding_response_dto_1.mapFindingToResponse)(updated);
    }
    async updateFindingStatus(id, newStatus, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_REVIEW_ROLES);
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
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_REVIEW_ROLES);
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
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({
            where: {
                id,
                deleted_at: null,
                ...((0, audit_utility_1.hasAuditeeRole)(actor.roles) && { auditee_id: actor.id }),
            },
            include: { evidence: true, follow_up: { include: { remediation_evidence: true } } },
        });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
        return (0, finding_response_dto_1.mapFindingToResponse)(finding);
    }
    async listFindings(engagementId, query, actor) {
        const findings = await prisma_client_1.prisma.audit_Finding.findMany({
            where: {
                engagement_id: engagementId,
                deleted_at: null,
                ...(query.severity && { severity: query.severity }),
                ...(query.status && { status: query.status }),
                ...(query.category && { category: query.category }),
                ...(query.auditeeId && { auditee_id: query.auditeeId }),
                ...((0, audit_utility_1.hasAuditeeRole)(actor.roles) && { auditee_id: actor.id }),
            },
            orderBy: { created_at: 'desc' },
        });
        return findings.map(finding_response_dto_1.mapFindingToResponse);
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
    async _getFinding(id) {
        const finding = await prisma_client_1.prisma.audit_Finding.findFirst({ where: { id, deleted_at: null } });
        if (!finding)
            throw app_error_1.AppError.notFound('Audit finding');
        return finding;
    }
}
exports.FindingService = FindingService;
//# sourceMappingURL=finding.service.js.map