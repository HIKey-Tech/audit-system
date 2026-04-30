"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const approval_service_1 = require("../../../../workflow/approval/service/implementation/approval.service");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const report_response_dto_1 = require("../../dto/response/report.response.dto");
const reportInclude = {
    engagement: {
        include: {
            findings: {
                where: { deleted_at: null },
                orderBy: { severity: 'asc' },
            },
        },
    },
};
class ReportService {
    followUpService;
    documentService;
    approvalService;
    constructor(followUpService, documentService, approvalService = approval_service_1.workflowApprovalService) {
        this.followUpService = followUpService;
        this.documentService = documentService;
        this.approvalService = approvalService;
    }
    async generateReport(engagementId, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_REVIEW_ROLES);
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            include: { findings: { where: { deleted_at: null } } },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (engagement.status !== audit_enum_1.EngagementStatus.UnderReview)
            throw app_error_1.AppError.badRequest('Engagement must be under review before report generation');
        const existing = await prisma_client_1.prisma.audit_Report.findFirst({
            where: { engagement_id: engagementId, deleted_at: null },
            select: { id: true },
        });
        if (existing)
            throw app_error_1.AppError.conflict('A report already exists for this engagement');
        const report = await prisma_client_1.prisma.audit_Report.create({
            data: {
                engagement_id: engagementId,
                title: `${engagement.title} Audit Report`,
                executive_summary: `Generated draft report for ${engagement.title}. Findings count: ${engagement.findings.length}.`,
                scope: `Scope based on engagement ${engagement.reference_number}.`,
                methodology: 'Internal audit procedures performed using working papers, evidence, checklist testing, and finding validation.',
                created_by_id: actor.id,
            },
            include: reportInclude,
        });
        logger_util_1.logger.info('Audit report generated', { reportId: report.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.generate', module: 'audit', entityType: 'audit_report', entityId: report.id });
        return (0, report_response_dto_1.mapReportToResponse)(report);
    }
    async updateReport(id, dto, actor) {
        const report = await this._getReport(id);
        const isAdmin = actor.roles.some((role) => role === 'super_admin' || role === 'audit_admin');
        if (report.created_by_id !== actor.id && !isAdmin)
            throw app_error_1.AppError.forbidden('Only the creator or audit admin can update this report');
        if (!audit_utility_1.REPORT_EDITABLE_STATUSES.includes(report.status))
            throw app_error_1.AppError.badRequest('Only draft or rejected reports can be updated');
        const updated = await prisma_client_1.prisma.audit_Report.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.executiveSummary !== undefined && { executive_summary: dto.executiveSummary }),
                ...(dto.scope !== undefined && { scope: dto.scope }),
                ...(dto.methodology !== undefined && { methodology: dto.methodology }),
                version_number: { increment: 1 },
                status: audit_enum_1.ReportStatus.Draft,
            },
            include: reportInclude,
        });
        logger_util_1.logger.info('Audit report updated', { reportId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.update', module: 'audit', entityType: 'audit_report', entityId: id });
        return (0, report_response_dto_1.mapReportToResponse)(updated);
    }
    async submitReportForApproval(id, actor) {
        const report = await this._getReport(id);
        const isAdmin = actor.roles.some((role) => role === 'super_admin' || role === 'audit_admin');
        if (report.created_by_id !== actor.id && !isAdmin)
            throw app_error_1.AppError.forbidden('Only the creator or audit admin can submit this report');
        if (report.status !== audit_enum_1.ReportStatus.Draft)
            throw app_error_1.AppError.badRequest('Only draft reports can be submitted');
        const updated = await prisma_client_1.prisma.audit_Report.update({
            where: { id },
            data: { status: audit_enum_1.ReportStatus.Submitted },
            include: reportInclude,
        });
        await this.approvalService.createApproval({
            entityType: workflow_enum_1.WorkflowEntityType.AuditReport,
            entityId: id,
        }, actor);
        logger_util_1.logger.info('Audit report submitted', { reportId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.submit', module: 'audit', entityType: 'audit_report', entityId: id });
        return (0, report_response_dto_1.mapReportToResponse)(updated);
    }
    async approveReport(id, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_ADMIN_ROLES);
        const report = await this._getReport(id);
        if (report.status !== audit_enum_1.ReportStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted reports can be approved');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, id);
        await this.approvalService.approve(approval.id, actor.id);
        const updated = await prisma_client_1.prisma.audit_Report.findFirst({
            where: { id, deleted_at: null },
            include: reportInclude,
        });
        if (!updated)
            throw app_error_1.AppError.notFound('Audit report');
        logger_util_1.logger.info('Audit report approved', { reportId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.approve', module: 'audit', entityType: 'audit_report', entityId: id });
        return (0, report_response_dto_1.mapReportToResponse)(updated);
    }
    async rejectReport(id, reason, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_ADMIN_ROLES);
        const report = await this._getReport(id);
        if (report.status !== audit_enum_1.ReportStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted reports can be rejected');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, id);
        await this.approvalService.reject(approval.id, actor.id, reason);
        const updated = await prisma_client_1.prisma.audit_Report.findFirst({
            where: { id, deleted_at: null },
            include: reportInclude,
        });
        if (!updated)
            throw app_error_1.AppError.notFound('Audit report');
        logger_util_1.logger.info('Audit report rejected', { reportId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.reject', module: 'audit', entityType: 'audit_report', entityId: id, newValues: { reason } });
        return (0, report_response_dto_1.mapReportToResponse)(updated);
    }
    async issueReport(id, actor) {
        (0, audit_utility_1.assertHasRole)(actor.roles, audit_utility_1.AUDIT_ADMIN_ROLES);
        const report = await prisma_client_1.prisma.audit_Report.findFirst({
            where: { id, deleted_at: null },
            include: reportInclude,
        });
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
        if (report.status !== audit_enum_1.ReportStatus.Approved)
            throw app_error_1.AppError.badRequest('Only approved reports can be issued');
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            const issued = await tx.audit_Report.update({
                where: { id },
                data: { status: audit_enum_1.ReportStatus.Issued, issued_at: new Date() },
                include: reportInclude,
            });
            await tx.audit_Engagement.update({
                where: { id: report.engagement_id },
                data: { status: audit_enum_1.EngagementStatus.Reported },
            });
            return issued;
        });
        await Promise.all(report.engagement.findings.map((finding) => this.followUpService.createFollowUp(finding.id)));
        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
            userId: report.engagement.auditee_id,
            title: 'Audit report issued',
            body: `Audit report "${report.title}" has been issued.`,
            type: 'info',
            referenceType: 'audit_report',
            referenceId: id,
        });
        logger_util_1.logger.info('Audit report issued', { reportId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.issue', module: 'audit', entityType: 'audit_report', entityId: id });
        return (0, report_response_dto_1.mapReportToResponse)(updated);
    }
    async getReport(engagementId) {
        const report = await prisma_client_1.prisma.audit_Report.findFirst({
            where: { engagement_id: engagementId, deleted_at: null },
            include: reportInclude,
        });
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
        return (0, report_response_dto_1.mapReportToResponse)(report);
    }
    async exportReport(id) {
        const report = await prisma_client_1.prisma.audit_Report.findFirst({
            where: { id, deleted_at: null },
            include: reportInclude,
        });
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
        const findings = report.engagement.findings.map((f, idx) => ({
            index: String(idx + 1),
            title: f.title,
            severity: f.severity,
            category: f.category,
            status: f.status,
            dueDate: f.due_date.toISOString().slice(0, 10),
            description: f.description,
            rootCause: f.root_cause,
            riskImplication: f.risk_implication,
            recommendation: f.recommendation,
        }));
        const buffer = await this.documentService.renderDocxTemplate('audit_report', {
            title: report.title,
            engagementReference: report.engagement.reference_number,
            engagementTitle: report.engagement.title,
            date: new Date().toISOString().slice(0, 10),
            status: report.status,
            version: String(report.version_number),
            issuedAt: report.issued_at ? report.issued_at.toISOString().slice(0, 10) : 'Not yet issued',
            executiveSummary: report.executive_summary,
            scope: report.scope,
            methodology: report.methodology,
            findings,
            findingCount: String(findings.length),
        });
        return {
            fileName: `${report.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-audit-report.docx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer,
        };
    }
    async _getReport(id) {
        const report = await prisma_client_1.prisma.audit_Report.findFirst({ where: { id, deleted_at: null } });
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
        return report;
    }
}
exports.ReportService = ReportService;
//# sourceMappingURL=report.service.js.map