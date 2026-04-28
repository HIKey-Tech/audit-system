"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkingPaperService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const approval_service_1 = require("../../../../workflow/approval/service/implementation/approval.service");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const working_paper_response_dto_1 = require("../../dto/response/working-paper.response.dto");
class WorkingPaperService {
    documentService;
    approvalService;
    constructor(documentService, approvalService = approval_service_1.workflowApprovalService) {
        this.documentService = documentService;
        this.approvalService = approvalService;
    }
    async createWorkingPaper(engagementId, dto, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_WORK_ROLES);
        await this._assertEngagementInProgress(engagementId);
        const paper = await prisma_client_1.prisma.audit_Working_Paper.create({
            data: {
                engagement_id: engagementId,
                title: dto.title,
                content: dto.content,
                created_by_id: actor.id,
            },
        });
        logger_util_1.logger.info('Audit working paper created', { workingPaperId: paper.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.create', module: 'audit', entityType: 'audit_working_paper', entityId: paper.id });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(paper);
    }
    async updateWorkingPaper(id, dto, actor) {
        const paper = await this._getPaper(id);
        if (paper.created_by_id !== actor.id)
            throw app_error_1.AppError.forbidden('Only the creator can update this working paper');
        if (!audit_utility_1.WP_REVIEWABLE_STATUSES.includes(paper.status)) {
            throw app_error_1.AppError.badRequest('Only draft or rejected working papers can be updated');
        }
        await this.documentService.upload({
            uploadedById: actor.id,
            originalName: `${paper.title}-v${paper.version_number}.txt`,
            mimeType: 'text/plain',
            fileSize: Buffer.byteLength(paper.content),
            buffer: Buffer.from(paper.content),
            module: 'audit',
            entityType: 'audit_working_paper_snapshot',
            entityId: paper.id,
        });
        const updated = await prisma_client_1.prisma.audit_Working_Paper.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.content !== undefined && { content: dto.content }),
                version_number: { increment: 1 },
                status: audit_enum_1.WorkingPaperStatus.Draft,
                rejection_reason: null,
            },
        });
        logger_util_1.logger.info('Audit working paper updated', { workingPaperId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.update', module: 'audit', entityType: 'audit_working_paper', entityId: id });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(updated);
    }
    async submitWorkingPaper(id, actor) {
        const paper = await this._getPaperWithEngagement(id);
        if (paper.created_by_id !== actor.id)
            throw app_error_1.AppError.forbidden('Only the creator can submit this working paper');
        if (!audit_utility_1.WP_REVIEWABLE_STATUSES.includes(paper.status)) {
            throw app_error_1.AppError.badRequest('Only draft or rejected working papers can be submitted');
        }
        const updated = await prisma_client_1.prisma.audit_Working_Paper.update({
            where: { id },
            data: { status: audit_enum_1.WorkingPaperStatus.Submitted, rejection_reason: null },
        });
        await this.approvalService.createApproval({
            entityType: workflow_enum_1.WorkflowEntityType.AuditWorkingPaper,
            entityId: id,
        }, actor);
        logger_util_1.logger.info('Audit working paper submitted', { workingPaperId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.submit', module: 'audit', entityType: 'audit_working_paper', entityId: id });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(updated);
    }
    async approveWorkingPaper(id, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_REVIEW_ROLES);
        const paper = await this._getPaper(id);
        if (paper.status !== audit_enum_1.WorkingPaperStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted working papers can be approved');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditWorkingPaper, id);
        await this.approvalService.approve(approval.id, actor.id);
        const updated = await this._getPaper(id);
        logger_util_1.logger.info('Audit working paper approved', { workingPaperId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.approve', module: 'audit', entityType: 'audit_working_paper', entityId: id });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(updated);
    }
    async rejectWorkingPaper(id, reason, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_REVIEW_ROLES);
        const paper = await this._getPaper(id);
        if (paper.status !== audit_enum_1.WorkingPaperStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted working papers can be rejected');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditWorkingPaper, id);
        await this.approvalService.reject(approval.id, actor.id, reason);
        const updated = await this._getPaper(id);
        logger_util_1.logger.info('Audit working paper rejected', { workingPaperId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.reject', module: 'audit', entityType: 'audit_working_paper', entityId: id, newValues: { reason } });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(updated);
    }
    async getWorkingPaperById(id) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id, deleted_at: null },
            include: { evidence: true },
        });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(paper);
    }
    async listWorkingPapers(engagementId) {
        const papers = await prisma_client_1.prisma.audit_Working_Paper.findMany({
            where: { engagement_id: engagementId, deleted_at: null },
            orderBy: { updated_at: 'desc' },
        });
        return papers.map(working_paper_response_dto_1.mapWorkingPaperToResponse);
    }
    async exportWorkingPaper(id) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id, deleted_at: null },
            include: {
                engagement: { select: { reference_number: true, title: true } },
                created_by: { select: { display_name: true, email: true } },
            },
        });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        const auditorName = paper.created_by.display_name || paper.created_by.email;
        const buffer = await this.documentService.renderDocxTemplate('working_paper', {
            title: paper.title,
            engagementReference: paper.engagement.reference_number,
            engagementTitle: paper.engagement.title,
            auditorName,
            date: new Date().toISOString().slice(0, 10),
            status: paper.status,
            version: String(paper.version_number),
            content: paper.content,
        });
        return {
            fileName: `${paper.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-working-paper.docx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer,
        };
    }
    async _assertEngagementInProgress(engagementId) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { status: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (engagement.status !== audit_enum_1.EngagementStatus.InProgress)
            throw app_error_1.AppError.badRequest('Engagement must be in progress');
    }
    async _getPaper(id) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({ where: { id, deleted_at: null } });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        return paper;
    }
    async _getPaperWithEngagement(id) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id, deleted_at: null },
            include: { engagement: true },
        });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        return paper;
    }
}
exports.WorkingPaperService = WorkingPaperService;
//# sourceMappingURL=working-paper.service.js.map