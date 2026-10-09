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
        const [universe, checklistGroups, approvedPapers, evidenceCount] = await Promise.all([
            prisma_client_1.prisma.audit_Universe.findUnique({ where: { id: engagement.universe_id }, select: { name: true, category: true } }),
            prisma_client_1.prisma.audit_Checklist.groupBy({ by: ['result'], where: { engagement_id: engagementId }, _count: { _all: true } }),
            prisma_client_1.prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null, status: 'approved' } }),
            prisma_client_1.prisma.audit_Evidence.count({ where: { engagement_id: engagementId } }),
        ]);
        const checklistCount = (result) => checklistGroups.find((g) => g.result === result)?._count._all ?? 0;
        const controlsTested = checklistGroups
            .filter((g) => g.result !== 'not_tested')
            .reduce((sum, g) => sum + g._count._all, 0);
        const bySeverity = ['critical', 'high', 'medium', 'low', 'informational']
            .map((sev) => ({ sev, n: engagement.findings.filter((f) => f.severity === sev).length }))
            .filter((x) => x.n > 0)
            .map((x) => `${x.n} ${x.sev}`);
        const dateOf = (d) => d.toISOString().slice(0, 10);
        const entityName = universe?.name ?? engagement.title;
        const auditType = engagement.audit_type.replace(/_/g, ' ');
        const period = `${dateOf(engagement.actual_start_date ?? engagement.planned_start_date)} to ${dateOf(engagement.actual_end_date ?? engagement.planned_end_date)}`;
        const findingsLine = engagement.findings.length === 0
            ? 'No findings were raised.'
            : `${engagement.findings.length} finding${engagement.findings.length === 1 ? ' was' : 's were'} raised (${bySeverity.join(', ')}).`;
        const defaultExecutiveSummary = `Internal Audit performed a ${auditType} audit of ${entityName} (${engagement.reference_number}) covering ${period}. ` +
            `${controlsTested} control${controlsTested === 1 ? ' was' : 's were'} tested: ${checklistCount('passed')} passed and ${checklistCount('failed')} failed. ` +
            `${findingsLine} Management responses and remediation timelines are tracked in the follow-up register.`;
        const defaultScope = `The audit covered ${entityName}${universe ? ` (${universe.category})` : ''} under engagement ${engagement.reference_number}, ` +
            `for the period ${period}. It assessed the design and operating effectiveness of the controls listed in the engagement checklist.`;
        const defaultMethodology = `Procedures comprised testing of ${controlsTested} control${controlsTested === 1 ? '' : 's'} against defined test procedures, ` +
            `review of ${evidenceCount} item${evidenceCount === 1 ? '' : 's'} of evidence, and ${approvedPapers} approved working paper${approvedPapers === 1 ? '' : 's'}. ` +
            `Failed control tests were recorded against the engagement and raised as findings where warranted.`;
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
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.report.update', module: 'audit', entityType: 'audit_report', entityId: id, oldValues: { title: report.title, status: report.status, versionNumber: report.version_number }, newValues: { title: updated.title, status: updated.status, versionNumber: updated.version_number } });
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
        else if (!audit_utility_1.REPORT_EDITABLE_STATUSES.includes(report.status)) {
            throw app_error_1.AppError.badRequest('Only draft or rejected reports can be submitted');
        }
        // A rejected report may be re-submitted as-is or after edits; either way the
        // approval chain restarts from level 1.
        const needsStatusChange = report.status === audit_enum_1.ReportStatus.Draft || report.status === audit_enum_1.ReportStatus.Rejected;
        const { submittedReport, approval } = await prisma_client_1.prisma.$transaction(async (tx) => {
            const submittedReport = needsStatusChange
                ? await tx.audit_Report.update({
                    where: { id },
                    data: { status: audit_enum_1.ReportStatus.Submitted, rejection_reason: null },
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
        // Findings only become visible to auditees now, so this is where each responder
        // (primary auditee or co-responder) learns what has been assigned to them.
        await this._notifyFindingResponders(report.engagement_id, report.engagement.reference_number);
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
    /** One in-app + email summary per responder of the findings assigned to them on this engagement. */
    async _notifyFindingResponders(engagementId, engagementReference) {
        try {
            const userSelect = { id: true, email: true };
            const findings = await prisma_client_1.prisma.audit_Finding.findMany({
                where: { engagement_id: engagementId, deleted_at: null },
                select: {
                    id: true,
                    title: true,
                    due_date: true,
                    auditee: { select: userSelect },
                    responders: { select: { user: { select: userSelect } } },
                },
            });
            const byUser = new Map();
            for (const finding of findings) {
                const users = [finding.auditee, ...finding.responders.map((r) => r.user)];
                for (const user of users) {
                    const entry = byUser.get(user.id) ?? { email: user.email, findings: [] };
                    if (!entry.findings.some((f) => f.id === finding.id)) {
                        entry.findings.push({ id: finding.id, title: finding.title, dueDate: finding.due_date.toISOString().slice(0, 10) });
                    }
                    byUser.set(user.id, entry);
                }
            }
            for (const [userId, entry] of byUser) {
                const single = entry.findings.length === 1 ? entry.findings[0] : null;
                const body = single
                    ? `Finding "${single.title}" (${engagementReference}) has been assigned to you. Due ${single.dueDate}.`
                    : `${entry.findings.length} findings from audit ${engagementReference} have been assigned to you. Please review them and submit your management responses.`;
                await notification_queue_service_1.notificationQueueService.enqueueSafe('in_app', {
                    userId,
                    title: 'Audit findings assigned',
                    body,
                    type: 'warning',
                    referenceType: single ? 'audit_finding' : 'audit_engagement',
                    referenceId: single ? single.id : engagementId,
                });
                if (entry.email) {
                    await notification_queue_service_1.notificationQueueService.enqueueSafe('email', {
                        to: entry.email,
                        subject: `Audit findings assigned: ${engagementReference}`,
                        text: body,
                    });
                }
            }
        }
        catch (err) {
            logger_util_1.logger.warn('Finding responder notification failed', { engagementId, err });
        }
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