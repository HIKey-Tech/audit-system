"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const date_fns_1 = require("date-fns");
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
const report_response_dto_1 = require("../../dto/response/report.response.dto");
const engagement_status_reconciler_1 = require("../../../engagement/service/implementation/engagement-status.reconciler");
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
    reportGenerationService;
    reportTemplateService;
    approvalService;
    constructor(followUpService, documentService, reportGenerationService, reportTemplateService, approvalService = approval_service_1.workflowApprovalService) {
        this.followUpService = followUpService;
        this.documentService = documentService;
        this.reportGenerationService = reportGenerationService;
        this.reportTemplateService = reportTemplateService;
        this.approvalService = approvalService;
    }
    async generateReport(engagementId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'report:create');
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
        if (dto.templateId) {
            // Throws notFound (→ 404) if the template id is invalid.
            await this.reportTemplateService.getTemplateById(dto.templateId);
        }
        const defaultExecutiveSummary = `Generated draft report for ${engagement.title}. Findings count: ${engagement.findings.length}.`;
        const defaultScope = `Scope based on engagement ${engagement.reference_number}.`;
        const defaultMethodology = 'Internal audit procedures performed using working papers, evidence, checklist testing, and finding validation.';
        const report = await prisma_client_1.prisma.audit_Report.create({
            data: {
                engagement_id: engagementId,
                title: `${engagement.title} Audit Report`,
                executive_summary: dto.executiveSummary ?? defaultExecutiveSummary,
                scope: dto.scope ?? defaultScope,
                methodology: dto.methodology ?? defaultMethodology,
                created_by_id: actor.id,
                template_id: dto.templateId ?? null,
            },
            include: reportInclude,
        });
        logger_util_1.logger.info('Audit report generated', { reportId: report.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.generate', module: 'audit', entityType: 'audit_report', entityId: report.id });
        return (0, report_response_dto_1.mapReportToResponse)(report);
    }
    async updateReport(id, dto, actor) {
        const report = await this._getReport(id);
        const canOverrideOwnership = actor.permissions.includes('report:approve');
        if (report.created_by_id !== actor.id && !canOverrideOwnership)
            throw app_error_1.AppError.forbidden('Only the creator or a report approver can update this report');
        if (!audit_utility_1.REPORT_EDITABLE_STATUSES.includes(report.status))
            throw app_error_1.AppError.badRequest('Only draft or rejected reports can be updated');
        const updated = await prisma_client_1.prisma.audit_Report.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.executiveSummary !== undefined && { executive_summary: dto.executiveSummary }),
                ...(dto.scope !== undefined && { scope: dto.scope }),
                ...(dto.methodology !== undefined && { methodology: dto.methodology }),
                ...(dto.templateId !== undefined && { template_id: dto.templateId }),
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
        const canOverrideOwnership = actor.permissions.includes('report:approve');
        if (report.created_by_id !== actor.id && !canOverrideOwnership)
            throw app_error_1.AppError.forbidden('Only the creator or a report approver can submit this report');
        if (report.status === audit_enum_1.ReportStatus.Submitted) {
            await this._assertSubmittedReportHasNoApproval(id);
        }
        else if (report.status !== audit_enum_1.ReportStatus.Draft) {
            throw app_error_1.AppError.badRequest('Only draft reports can be submitted');
        }
        const { submittedReport, approval } = await prisma_client_1.prisma.$transaction(async (tx) => {
            const submittedReport = report.status === audit_enum_1.ReportStatus.Draft
                ? await tx.audit_Report.update({
                    where: { id },
                    data: { status: audit_enum_1.ReportStatus.Submitted },
                    include: reportInclude,
                })
                : await tx.audit_Report.findFirstOrThrow({
                    where: { id, deleted_at: null },
                    include: reportInclude,
                });
            const approval = await this.approvalService.createApproval({
                entityType: workflow_enum_1.WorkflowEntityType.AuditReport,
                entityId: id,
            }, actor, tx);
            return { submittedReport, approval };
        }, { timeout: 15000 });
        this.approvalService.queueApprovalRequiredNotification(approval);
        logger_util_1.logger.info('Audit report submitted', { reportId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.submit', module: 'audit', entityType: 'audit_report', entityId: id });
        return (0, report_response_dto_1.mapReportToResponse)(submittedReport);
    }
    async approveReport(id, actor) {
        const report = await this._getReport(id);
        if (report.status !== audit_enum_1.ReportStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted reports can be approved');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, id);
        await this.approvalService.approve(approval.id, actor);
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
        const report = await this._getReport(id);
        if (report.status !== audit_enum_1.ReportStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted reports can be rejected');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, id);
        await this.approvalService.reject(approval.id, actor, reason);
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
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'report:issue');
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
        const [auditee, issuer] = await Promise.all([
            prisma_client_1.prisma.user.findUnique({
                where: { id: report.engagement.auditee_id },
                select: { email: true, display_name: true, first_name: true, last_name: true },
            }),
            prisma_client_1.prisma.user.findUnique({
                where: { id: actor.id },
                select: { display_name: true, first_name: true, last_name: true },
            }),
        ]);
        const auditeeName = auditee?.display_name ?? `${auditee?.first_name ?? ''} ${auditee?.last_name ?? ''}`.trim();
        const issuedBy = issuer?.display_name ?? `${issuer?.first_name ?? ''} ${issuer?.last_name ?? ''}`.trim();
        const reportVariables = {
            auditeeName,
            reportTitle: report.title,
            engagementTitle: report.engagement.title,
            engagementReference: report.engagement.reference_number,
            issuedBy,
            findingCount: String(report.engagement.findings.length),
        };
        // Post-commit: the report is already issued, so a queue-write hiccup must
        // not fail the request — enqueueSafe swallows and logs.
        await notification_queue_service_1.notificationQueueService.enqueueSafe('in_app', {
            userId: report.engagement.auditee_id,
            title: 'Audit report issued',
            body: `Audit report "${report.title}" has been issued.`,
            type: 'info',
            // The frontend has no report detail page — land the auditee on the
            // engagement (Report tab) instead of a dead reference.
            referenceType: 'audit_engagement',
            referenceId: report.engagement_id,
            eventKey: 'audit.report.issued',
            variables: reportVariables,
        });
        if (auditee?.email) {
            await notification_queue_service_1.notificationQueueService.enqueueSafe('email', {
                to: auditee.email,
                subject: `Audit Report Issued: ${report.title}`,
                text: `Audit report "${report.title}" has been issued.`,
                eventKey: 'audit.report.issued',
                variables: reportVariables,
            });
        }
        logger_util_1.logger.info('Audit report issued', { reportId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.issue', module: 'audit', entityType: 'audit_report', entityId: id });
        // Fire-and-forget auto-generation of both formats after issue
        void this.reportGenerationService.generatePdf(id).then(async (buffer) => {
            const fileName = `GBB-IAR-${updated.engagement.reference_number}-${(0, date_fns_1.format)(new Date(), 'yyyy-MM-dd')}.pdf`;
            const uploaded = await this.documentService.upload({
                uploadedById: actor.id,
                originalName: fileName,
                mimeType: 'application/pdf',
                fileSize: buffer.length,
                buffer,
                module: 'audit',
                entityType: 'audit_report',
                entityId: id,
            });
            await prisma_client_1.prisma.audit_Report.update({
                where: { id },
                data: { document_id: uploaded.id },
            });
        }).catch((err) => logger_util_1.logger.warn('PDF generation failed after issue', { err, reportId: id }));
        void this.reportGenerationService.generateDocx(id).then(async (buffer) => {
            const fileName = `GBB-IAR-${updated.engagement.reference_number}-${(0, date_fns_1.format)(new Date(), 'yyyy-MM-dd')}.docx`;
            await this.documentService.upload({
                uploadedById: actor.id,
                originalName: fileName,
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                fileSize: buffer.length,
                buffer,
                module: 'audit',
                entityType: 'audit_report',
                entityId: id,
            });
        }).catch((err) => logger_util_1.logger.warn('DOCX generation failed after issue', { err, reportId: id }));
        // Issuing the report is the human act; the engagement follows into "reported".
        await (0, engagement_status_reconciler_1.reconcileEngagementStatus)(report.engagement_id, actor.id);
        return (0, report_response_dto_1.mapReportToResponse)(updated);
    }
    _actorReportScope(actor) {
        if (actor.permissions.includes('engagement:read_all'))
            return undefined;
        return {
            engagement: {
                OR: [
                    { lead_auditor_id: actor.id },
                    { audit_manager_id: actor.id },
                    { workflow_assignments: { some: { user_id: actor.id } } },
                    {
                        AND: [
                            { auditee_id: actor.id },
                            { report: { status: audit_enum_1.ReportStatus.Issued } },
                        ],
                    },
                ],
            },
        };
    }
    async getReport(engagementId, actor) {
        const scope = this._actorReportScope(actor);
        const report = await prisma_client_1.prisma.audit_Report.findFirst({
            where: {
                engagement_id: engagementId,
                deleted_at: null,
                ...(scope ?? {}),
            },
            include: reportInclude,
        });
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
        return (0, report_response_dto_1.mapReportToResponse)(report);
    }
    async getReportById(id, actor) {
        const scope = this._actorReportScope(actor);
        const report = await prisma_client_1.prisma.audit_Report.findFirst({
            where: {
                id,
                deleted_at: null,
                ...(scope ?? {}),
            },
            include: reportInclude,
        });
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
        return (0, report_response_dto_1.mapReportToResponse)(report);
    }
    async listReports(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const scope = this._actorReportScope(actor);
        const where = {
            deleted_at: null,
            ...(query.status && { status: query.status }),
            ...(query.search && {
                OR: [
                    { title: { contains: query.search } },
                    { executive_summary: { contains: query.search } },
                    { engagement: { reference_number: { contains: query.search } } },
                ],
            }),
            ...(scope ?? {}),
        };
        const [total, reports] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Report.count({ where }),
            prisma_client_1.prisma.audit_Report.findMany({
                where,
                include: reportInclude,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            reports: reports.map(report_response_dto_1.mapReportToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async exportReport(id, format, actor) {
        const scope = this._actorReportScope(actor);
        const exists = await prisma_client_1.prisma.audit_Report.count({
            where: { id, deleted_at: null, ...(scope ?? {}) },
        });
        if (exists === 0)
            throw app_error_1.AppError.notFound('Audit report');
        const file = await this.reportGenerationService.exportReport(id, format);
        return {
            fileName: file.filename,
            mimeType: file.mimeType,
            buffer: file.buffer,
        };
    }
    async _getReport(id) {
        const report = await prisma_client_1.prisma.audit_Report.findFirst({ where: { id, deleted_at: null } });
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
        return report;
    }
    async _assertSubmittedReportHasNoApproval(id) {
        try {
            await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, id);
        }
        catch (err) {
            if (err instanceof app_error_1.AppError && err.errorCode === app_error_1.ErrorCode.NOT_FOUND)
                return;
            throw err;
        }
        throw app_error_1.AppError.badRequest('Only draft reports can be submitted');
    }
}
exports.ReportService = ReportService;
//# sourceMappingURL=report.service.js.map