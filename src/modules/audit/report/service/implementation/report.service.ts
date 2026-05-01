import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError, ErrorCode } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
import { WorkflowEntityType } from '../../../../workflow/domain/enum/workflow.enum';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { EngagementStatus, ReportStatus } from '../../../domain/enum/audit.enum';
import { AUDIT_ADMIN_ROLES, AUDIT_REVIEW_ROLES, REPORT_EDITABLE_STATUSES, assertHasRole } from '../../../utility/audit.utility';
import { IFollowUpService } from '../../../follow-up/service/interface/follow-up.service.interface';
import { UpdateReportRequestDto } from '../../dto/request/report.request.dto';
import { ReportResponseDto, mapReportToResponse } from '../../dto/response/report.response.dto';
import { IReportService } from '../interface/report.service.interface';

const reportInclude = {
  engagement: {
    include: {
      findings: {
        where: { deleted_at: null },
        orderBy: { severity: 'asc' as const },
      },
    },
  },
};

export class ReportService implements IReportService {
  constructor(
    private readonly followUpService: IFollowUpService,
    private readonly documentService: IDocumentService,
    private readonly approvalService: IApprovalService = workflowApprovalService,
  ) {}

  async generateReport(engagementId: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto> {
    assertHasRole(actor.roles, AUDIT_REVIEW_ROLES);

    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      include: { findings: { where: { deleted_at: null } } },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    if (engagement.status !== EngagementStatus.UnderReview) throw AppError.badRequest('Engagement must be under review before report generation');

    const existing = await prisma.audit_Report.findFirst({
      where: { engagement_id: engagementId, deleted_at: null },
      select: { id: true },
    });
    if (existing) throw AppError.conflict('A report already exists for this engagement');

    const defaultExecutiveSummary = `Generated draft report for ${engagement.title}. Findings count: ${engagement.findings.length}.`;
    const defaultScope = `Scope based on engagement ${engagement.reference_number}.`;
    const defaultMethodology = 'Internal audit procedures performed using working papers, evidence, checklist testing, and finding validation.';

    const report = await prisma.audit_Report.create({
      data: {
        engagement_id: engagementId,
        title: `${engagement.title} Audit Report`,
        executive_summary: dto.executiveSummary ?? defaultExecutiveSummary,
        scope: dto.scope ?? defaultScope,
        methodology: dto.methodology ?? defaultMethodology,
        created_by_id: actor.id,
      },
      include: reportInclude,
    });

    logger.info('Audit report generated', { reportId: report.id, engagementId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.generate', module: 'audit', entityType: 'audit_report', entityId: report.id });
    return mapReportToResponse(report);
  }

  async updateReport(id: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto> {
    const report = await this._getReport(id);
    const isAdmin = actor.roles.some((role) => role === 'super_admin' || role === 'audit_admin');
    if (report.created_by_id !== actor.id && !isAdmin) throw AppError.forbidden('Only the creator or audit admin can update this report');
    if (!REPORT_EDITABLE_STATUSES.includes(report.status as ReportStatus)) throw AppError.badRequest('Only draft or rejected reports can be updated');

    const updated = await prisma.audit_Report.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.executiveSummary !== undefined && { executive_summary: dto.executiveSummary }),
        ...(dto.scope !== undefined && { scope: dto.scope }),
        ...(dto.methodology !== undefined && { methodology: dto.methodology }),
        version_number: { increment: 1 },
        status: ReportStatus.Draft,
      },
      include: reportInclude,
    });

    logger.info('Audit report updated', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.update', module: 'audit', entityType: 'audit_report', entityId: id });
    return mapReportToResponse(updated);
  }

  async submitReportForApproval(id: string, actor: ActorContext): Promise<ReportResponseDto> {
    const report = await this._getReport(id);
    const isAdmin = actor.roles.some((role) => role === 'super_admin' || role === 'audit_admin');
    if (report.created_by_id !== actor.id && !isAdmin) throw AppError.forbidden('Only the creator or audit admin can submit this report');

    if (report.status === ReportStatus.Submitted) {
      await this._assertSubmittedReportHasNoApproval(id);
    } else if (report.status !== ReportStatus.Draft) {
      throw AppError.badRequest('Only draft reports can be submitted');
    }

    const { submittedReport, approval } = await prisma.$transaction(async (tx) => {
      const submittedReport = report.status === ReportStatus.Draft
        ? await tx.audit_Report.update({
            where: { id },
            data: { status: ReportStatus.Submitted },
            include: reportInclude,
          })
        : await tx.audit_Report.findFirstOrThrow({
            where: { id, deleted_at: null },
            include: reportInclude,
          });

      const approval = await this.approvalService.createApproval({
        entityType: WorkflowEntityType.AuditReport,
        entityId: id,
      }, actor, tx);

      return { submittedReport, approval };
    }, { timeout: 15000 });
    this.approvalService.queueApprovalRequiredNotification(approval);
    logger.info('Audit report submitted', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.submit', module: 'audit', entityType: 'audit_report', entityId: id });
    return mapReportToResponse(submittedReport);
  }

  async approveReport(id: string, actor: ActorContext): Promise<ReportResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    const report = await this._getReport(id);
    if (report.status !== ReportStatus.Submitted) throw AppError.badRequest('Only submitted reports can be approved');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditReport, id);
    await this.approvalService.approve(approval.id, actor.id);
    const updated = await prisma.audit_Report.findFirst({
      where: { id, deleted_at: null },
      include: reportInclude,
    });
    if (!updated) throw AppError.notFound('Audit report');

    logger.info('Audit report approved', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.approve', module: 'audit', entityType: 'audit_report', entityId: id });
    return mapReportToResponse(updated);
  }

  async rejectReport(id: string, reason: string, actor: ActorContext): Promise<ReportResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    const report = await this._getReport(id);
    if (report.status !== ReportStatus.Submitted) throw AppError.badRequest('Only submitted reports can be rejected');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditReport, id);
    await this.approvalService.reject(approval.id, actor.id, reason);
    const updated = await prisma.audit_Report.findFirst({
      where: { id, deleted_at: null },
      include: reportInclude,
    });
    if (!updated) throw AppError.notFound('Audit report');

    logger.info('Audit report rejected', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.reject', module: 'audit', entityType: 'audit_report', entityId: id, newValues: { reason } });
    return mapReportToResponse(updated);
  }

  async issueReport(id: string, actor: ActorContext): Promise<ReportResponseDto> {
    assertHasRole(actor.roles, AUDIT_ADMIN_ROLES);
    const report = await prisma.audit_Report.findFirst({
      where: { id, deleted_at: null },
      include: reportInclude,
    });
    if (!report) throw AppError.notFound('Audit report');
    if (report.status !== ReportStatus.Approved) throw AppError.badRequest('Only approved reports can be issued');

    const updated = await prisma.$transaction(async (tx) => {
      const issued = await tx.audit_Report.update({
        where: { id },
        data: { status: ReportStatus.Issued, issued_at: new Date() },
        include: reportInclude,
      });
      await tx.audit_Engagement.update({
        where: { id: report.engagement_id },
        data: { status: EngagementStatus.Reported },
      });
      return issued;
    });

    await Promise.all(report.engagement.findings.map((finding) => this.followUpService.createFollowUp(finding.id)));
    await notificationQueueService.enqueue(
      'in_app',
      {
        userId: report.engagement.auditee_id,
        title: 'Audit report issued',
        body: `Audit report "${report.title}" has been issued.`,
        type: 'info',
        referenceType: 'audit_report',
        referenceId: id,
      },
    );

    logger.info('Audit report issued', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.issue', module: 'audit', entityType: 'audit_report', entityId: id });
    return mapReportToResponse(updated);
  }

  async getReport(engagementId: string): Promise<ReportResponseDto> {
    const report = await prisma.audit_Report.findFirst({
      where: { engagement_id: engagementId, deleted_at: null },
      include: reportInclude,
    });
    if (!report) throw AppError.notFound('Audit report');
    return mapReportToResponse(report);
  }

  async exportReport(id: string): Promise<ExportedAuditFile> {
    const report = await prisma.audit_Report.findFirst({
      where: { id, deleted_at: null },
      include: reportInclude,
    });
    if (!report) throw AppError.notFound('Audit report');

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

  private async _getReport(id: string) {
    const report = await prisma.audit_Report.findFirst({ where: { id, deleted_at: null } });
    if (!report) throw AppError.notFound('Audit report');
    return report;
  }

  private async _assertSubmittedReportHasNoApproval(id: string): Promise<void> {
    try {
      await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditReport, id);
    } catch (err) {
      if (err instanceof AppError && err.errorCode === ErrorCode.NOT_FOUND) return;
      throw err;
    }
    throw AppError.badRequest('Only draft reports can be submitted');
  }

}
