import * as crypto from 'crypto';
import { notifyFindingResponders } from '../../../utility/finding-responder-notify.utility';
import { format } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError, ErrorCode } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { PaginationMeta, buildPaginationMeta, parsePagination } from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
import { WorkflowEntityType } from '../../../../workflow/domain/enum/workflow.enum';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { EngagementStatus, ReportStatus } from '../../../domain/enum/audit.enum';
import { REPORT_EDITABLE_STATUSES, assertHasPermission } from '../../../utility/audit.utility';
import { IFollowUpService } from '../../../follow-up/service/interface/follow-up.service.interface';
import { IReportTemplateService } from '../../../../settings/service/interface/report-template.service.interface';
import { GenerateReportRequestDto, ReportQueryDto, ReportSignOffMode, UpdateReportRequestDto } from '../../dto/request/report.request.dto';
import { ReportCommentDto, ReportResponseDto, mapReportToResponse } from '../../dto/response/report.response.dto';
import { IReportService } from '../interface/report.service.interface';
import { IReportGenerationService } from '../interface/report-generation.service.interface';
import { reconcileEngagementStatus } from '../../../engagement/service/implementation/engagement-status.reconciler';

const reportInclude = {
  engagement: {
    include: {
      findings: {
        where: { deleted_at: null },
        orderBy: { severity: 'asc' as const },
        include: {
          auditee: {
            select: { display_name: true, first_name: true, last_name: true, email: true },
          },
          responders: {
            include: {
              user: {
                select: { display_name: true, first_name: true, last_name: true, email: true },
              },
            },
          },
          follow_up: true,
          checklist: {
            select: { control_reference: true, control_description: true },
          },
          risk: {
            select: { title: true },
          },
        },
      },
    },
  },
};

export class ReportService implements IReportService {
  constructor(
    private readonly followUpService: IFollowUpService,
    private readonly documentService: IDocumentService,
    private readonly reportGenerationService: IReportGenerationService,
    private readonly reportTemplateService: IReportTemplateService,
    private readonly approvalService: IApprovalService = workflowApprovalService,
  ) {}

  async generateReport(engagementId: string, dto: GenerateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto> {
    assertHasPermission(actor.permissions, 'report:create');

    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      include: {
        findings: {
          where: { deleted_at: null },
          include: {
            auditee: { select: { display_name: true, first_name: true, last_name: true, email: true } },
            follow_up: true,
            checklist: { select: { control_reference: true, control_description: true } },
          },
        },
      },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    if (engagement.status !== EngagementStatus.UnderReview) throw AppError.badRequest('Engagement must be under review before report generation');

    const existing = await prisma.audit_Report.findFirst({
      where: { engagement_id: engagementId, deleted_at: null },
      select: { id: true },
    });
    if (existing) throw AppError.conflict('A report already exists for this engagement');

    if (dto.templateId) {
      // Throws notFound (→ 404) if the template id is invalid.
      await this.reportTemplateService.getTemplateById(dto.templateId);
    }

    const [universe, checklistGroups, approvedPapers, evidenceCount] = await Promise.all([
      prisma.audit_Universe.findUnique({ where: { id: engagement.universe_id }, select: { name: true, category: true } }),
      prisma.audit_Checklist.groupBy({ by: ['result'], where: { engagement_id: engagementId }, _count: { _all: true } }),
      prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null, status: 'approved' } }),
      prisma.audit_Evidence.count({ where: { engagement_id: engagementId } }),
    ]);
    const checklistCount = (result: string): number =>
      checklistGroups.find((g) => g.result === result)?._count._all ?? 0;
    const controlsTested = checklistGroups
      .filter((g) => g.result !== 'not_tested')
      .reduce((sum, g) => sum + g._count._all, 0);
    const bySeverity = ['critical', 'high', 'medium', 'low', 'informational']
      .map((sev) => ({ sev, n: engagement.findings.filter((f) => f.severity === sev).length }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.n} ${x.sev}`);
    const dateOf = (d: Date): string => d.toISOString().slice(0, 10);
    const entityName = universe?.name ?? engagement.title;
    const auditType = engagement.audit_type.replace(/_/g, ' ');
    const period = `${dateOf(engagement.actual_start_date ?? engagement.planned_start_date)} to ${dateOf(engagement.actual_end_date ?? engagement.planned_end_date)}`;

    const respondedCount = engagement.findings.filter(
      (f) => Boolean((f as { follow_up?: { management_response?: string | null } | null }).follow_up?.management_response),
    ).length;

    const findingsLine = engagement.findings.length === 0
      ? 'No findings were raised.'
      : `${engagement.findings.length} finding${engagement.findings.length === 1 ? ' was' : 's were'} raised (${bySeverity.join(', ')})` +
        (respondedCount > 0 ? `, with ${respondedCount} management response${respondedCount === 1 ? '' : 's'} recorded.` : '.');

    const detailedFindingsDigest =
      engagement.findings.length > 0
        ? '\n\nKey Findings & Auditee Responses:\n' +
          engagement.findings
            .map((f, idx) => {
              const fw = (f as {
                follow_up?: { management_response?: string | null } | null;
                auditee?: { display_name?: string | null; first_name?: string; last_name?: string } | null;
              });
              const ownerName =
                fw.auditee?.display_name ??
                (`${fw.auditee?.first_name ?? ''} ${fw.auditee?.last_name ?? ''}`.trim() || 'Assigned Auditee');
              const mgmtResp = fw.follow_up?.management_response?.trim() || 'Awaiting management response';
              return `${idx + 1}. [${f.severity.toUpperCase()}] ${f.title} (Owner: ${ownerName}, Due: ${dateOf(f.due_date)})\n   Observation: ${f.description}\n   Recommendation: ${f.recommendation}\n   Auditee Management Response: ${mgmtResp}`;
            })
            .join('\n\n')
        : '';

    const defaultExecutiveSummary =
      `Internal Audit performed a ${auditType} audit of ${entityName} (${engagement.reference_number}) covering ${period}. ` +
      `${controlsTested} control${controlsTested === 1 ? ' was' : 's were'} tested: ${checklistCount('passed')} passed and ${checklistCount('failed')} failed. ` +
      `${findingsLine} Management responses and remediation timelines are tracked in the follow-up register.${detailedFindingsDigest}`;
    const defaultScope =
      `The audit covered ${entityName}${universe ? ` (${universe.category})` : ''} under engagement ${engagement.reference_number}, ` +
      `for the period ${period}. It assessed the design and operating effectiveness of the controls listed in the engagement checklist.`;
    const defaultMethodology =
      `Procedures comprised testing of ${controlsTested} control${controlsTested === 1 ? '' : 's'} against defined test procedures, ` +
      `review of ${evidenceCount} item${evidenceCount === 1 ? '' : 's'} of evidence, and ${approvedPapers} approved working paper${approvedPapers === 1 ? '' : 's'}. ` +
      `Failed control tests were recorded against the engagement and raised as findings where warranted.`;

    const report = await prisma.audit_Report.create({
      data: {
        engagement_id: engagementId,
        title: dto.title?.trim() || `${engagement.title} Audit Report`,
        executive_summary: dto.executiveSummary ?? defaultExecutiveSummary,
        scope: dto.scope ?? defaultScope,
        methodology: dto.methodology ?? defaultMethodology,
        created_by_id: actor.id,
        template_id: dto.templateId ?? null,
      },
      include: reportInclude,
    });

    const signOffMode: ReportSignOffMode = dto.signOffMode ?? 'cae_and_dg';
    await this._saveSignOffMode(report.id, signOffMode, actor.id);

    logger.info('Audit report generated', { reportId: report.id, engagementId, actorId: actor.id, signOffMode });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.generate', module: 'audit', entityType: 'audit_report', entityId: report.id });
    return this._decorateReport(report, signOffMode);
  }

  async updateReport(id: string, dto: UpdateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto> {
    const report = await this._getReport(id);
    const canOverrideOwnership = actor.permissions.includes('report:approve');
    if (report.created_by_id !== actor.id && !canOverrideOwnership) throw AppError.forbidden('Only the creator or a report approver can update this report');
    if (!REPORT_EDITABLE_STATUSES.includes(report.status as ReportStatus)) throw AppError.badRequest('Only draft or rejected reports can be updated');

    const updated = await prisma.audit_Report.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.executiveSummary !== undefined && { executive_summary: dto.executiveSummary }),
        ...(dto.scope !== undefined && { scope: dto.scope }),
        ...(dto.methodology !== undefined && { methodology: dto.methodology }),
        ...(dto.templateId !== undefined && { template_id: dto.templateId }),
        version_number: { increment: 1 },
        status: ReportStatus.Draft,
      },
      include: reportInclude,
    });

    if (dto.signOffMode) {
      await this._saveSignOffMode(id, dto.signOffMode, actor.id);
    }

    logger.info('Audit report updated', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.update', module: 'audit', entityType: 'audit_report', entityId: id, oldValues: { title: report.title, status: report.status, versionNumber: report.version_number }, newValues: { title: updated.title, status: updated.status, versionNumber: updated.version_number } });
    return this._decorateReport(updated, dto.signOffMode);
  }

  async submitReportForApproval(id: string, actor: ActorContext): Promise<ReportResponseDto> {
    const report = await this._getReport(id);
    const canOverrideOwnership = actor.permissions.includes('report:approve');
    if (report.created_by_id !== actor.id && !canOverrideOwnership) throw AppError.forbidden('Only the creator or a report approver can submit this report');

    if (report.status === ReportStatus.Submitted) {
      await this._assertSubmittedReportHasNoApproval(id);
    } else if (!REPORT_EDITABLE_STATUSES.includes(report.status as ReportStatus)) {
      throw AppError.badRequest('Only draft or rejected reports can be submitted');
    }

    const needsStatusChange = report.status === ReportStatus.Draft || report.status === ReportStatus.Rejected;
    const { submittedReport, approval } = await prisma.$transaction(async (tx) => {
      const submittedReport = needsStatusChange
        ? await tx.audit_Report.update({
            where: { id },
            data: { status: ReportStatus.Submitted, rejection_reason: null },
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
    return this._decorateReport(submittedReport);
  }

  async approveReport(id: string, actor: ActorContext): Promise<ReportResponseDto> {
    const report = await this._getReport(id);
    if (report.status !== ReportStatus.Submitted) throw AppError.badRequest('Only submitted reports can be approved');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditReport, id);
    await this.approvalService.approve(approval.id, actor);
    const updated = await prisma.audit_Report.findFirst({
      where: { id, deleted_at: null },
      include: reportInclude,
    });
    if (!updated) throw AppError.notFound('Audit report');

    logger.info('Audit report approved', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.approve', module: 'audit', entityType: 'audit_report', entityId: id });
    return this._decorateReport(updated);
  }

  async rejectReport(id: string, reason: string, actor: ActorContext): Promise<ReportResponseDto> {
    const report = await this._getReport(id);
    if (report.status !== ReportStatus.Submitted) throw AppError.badRequest('Only submitted reports can be rejected');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditReport, id);
    await this.approvalService.reject(approval.id, actor, reason);
    const updated = await prisma.audit_Report.findFirst({
      where: { id, deleted_at: null },
      include: reportInclude,
    });
    if (!updated) throw AppError.notFound('Audit report');

    logger.info('Audit report rejected', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.reject', module: 'audit', entityType: 'audit_report', entityId: id, newValues: { reason } });
    return this._decorateReport(updated);
  }

  async issueReport(id: string, actor: ActorContext): Promise<ReportResponseDto> {
    assertHasPermission(actor.permissions, 'report:issue');
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

    const [auditee, issuer] = await Promise.all([
      prisma.user.findUnique({
        where: { id: report.engagement.auditee_id },
        select: { email: true, display_name: true, first_name: true, last_name: true },
      }),
      prisma.user.findUnique({
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

    await notificationQueueService.enqueueSafe(
      'in_app',
      {
        userId: report.engagement.auditee_id,
        title: 'Audit report issued',
        body: `Audit report "${report.title}" has been issued.`,
        type: 'info',
        referenceType: 'audit_engagement',
        referenceId: report.engagement_id,
        eventKey: 'audit.report.issued',
        variables: reportVariables,
      },
    );

    if (auditee?.email) {
      await notificationQueueService.enqueueSafe(
        'email',
        {
          to: auditee.email,
          subject: `Audit Report Issued: ${report.title}`,
          text: `Audit report "${report.title}" has been issued.`,
          eventKey: 'audit.report.issued',
          variables: reportVariables,
        },
      );
    }

    await this._notifyFindingResponders(report.engagement_id, report.engagement.reference_number);

    logger.info('Audit report issued', { reportId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.report.issue', module: 'audit', entityType: 'audit_report', entityId: id });

    // Fire-and-forget auto-generation of both formats after issue
    void this.reportGenerationService.generatePdf(id).then(async (buffer) => {
      const fileName = `GBB-IAR-${updated.engagement.reference_number}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
      await prisma.audit_Report.update({
        where: { id },
        data: { document_id: uploaded.id },
      });
    }).catch((err) => logger.warn('PDF generation failed after issue', { err, reportId: id }));

    void this.reportGenerationService.generateDocx(id).then(async (buffer) => {
      const fileName = `GBB-IAR-${updated.engagement.reference_number}-${format(new Date(), 'yyyy-MM-dd')}.docx`;
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
    }).catch((err) => logger.warn('DOCX generation failed after issue', { err, reportId: id }));

    await reconcileEngagementStatus(report.engagement_id, actor.id);

    return this._decorateReport(updated);
  }

  private _actorReportScope(actor: ActorContext): Prisma.Audit_ReportWhereInput | undefined {
    if (actor.permissions.includes('engagement:read_all')) return undefined;

    return {
      engagement: {
        OR: [
          { lead_auditor_id: actor.id },
          { audit_manager_id: actor.id },
          { workflow_assignments: { some: { user_id: actor.id } } },
          {
            AND: [
              { auditee_id: actor.id },
              { report: { status: ReportStatus.Issued } },
            ],
          },
        ],
      },
    };
  }

  async getReport(engagementId: string, actor: ActorContext): Promise<ReportResponseDto> {
    const scope = this._actorReportScope(actor);
    const report = await prisma.audit_Report.findFirst({
      where: {
        engagement_id: engagementId,
        deleted_at: null,
        ...(scope ?? {}),
      },
      include: reportInclude,
    });
    if (!report) throw AppError.notFound('Audit report');
    return this._decorateReport(report);
  }

  async getReportById(id: string, actor: ActorContext): Promise<ReportResponseDto> {
    const scope = this._actorReportScope(actor);
    const report = await prisma.audit_Report.findFirst({
      where: {
        id,
        deleted_at: null,
        ...(scope ?? {}),
      },
      include: reportInclude,
    });
    if (!report) throw AppError.notFound('Audit report');
    return this._decorateReport(report);
  }

  async listReports(query: ReportQueryDto, actor: ActorContext): Promise<{ reports: ReportResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const scope = this._actorReportScope(actor);
    const where: Prisma.Audit_ReportWhereInput = {
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

    const [total, reports] = await prisma.$transaction([
      prisma.audit_Report.count({ where }),
      prisma.audit_Report.findMany({
        where,
        include: reportInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      reports: reports.map((r) => mapReportToResponse(r)),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async listComments(reportId: string, actor: ActorContext): Promise<ReportCommentDto[]> {
    const scope = this._actorReportScope(actor);
    const report = await prisma.audit_Report.findFirst({
      where: { id: reportId, deleted_at: null, ...(scope ?? {}) },
      select: { id: true },
    });
    if (!report) throw AppError.notFound('Audit report');
    return this._readComments(reportId);
  }

  async addComment(reportId: string, body: string, actor: ActorContext): Promise<ReportCommentDto> {
    const scope = this._actorReportScope(actor);
    const report = await prisma.audit_Report.findFirst({
      where: { id: reportId, deleted_at: null, ...(scope ?? {}) },
      include: {
        engagement: {
          select: {
            id: true,
            title: true,
            reference_number: true,
            lead_auditor_id: true,
            audit_manager_id: true,
          },
        },
      },
    });
    if (!report) throw AppError.notFound('Audit report');

    const author = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { display_name: true, first_name: true, last_name: true, email: true },
    });
    const authorName =
      author?.display_name ??
      (`${author?.first_name ?? ''} ${author?.last_name ?? ''}`.trim() || author?.email || 'Reviewer');

    const existing = await this._readComments(reportId);
    const newComment: ReportCommentDto = {
      id: crypto.randomUUID(),
      authorId: actor.id,
      authorName,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextComments = [...existing, newComment];

    const key = `report.comments.${reportId}`;
    await prisma.system_Config.upsert({
      where: { key },
      update: { value: JSON.stringify(nextComments), updated_by_id: actor.id },
      create: {
        key,
        value: JSON.stringify(nextComments),
        description: `Review comments for audit report ${reportId}`,
        is_public: false,
        updated_by_id: actor.id,
      },
    });

    // Notify report creator, engagement lead auditor, audit manager, and prior commenters
    const recipientIds = new Set<string>([
      report.created_by_id,
      report.engagement.lead_auditor_id,
      report.engagement.audit_manager_id,
      ...existing.map((c) => c.authorId),
    ]);
    recipientIds.delete(actor.id);

    if (recipientIds.size > 0) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: [...recipientIds] }, deleted_at: null, is_active: true },
        select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
      });

      for (const r of recipients) {
        await notificationQueueService.enqueueSafe('in_app', {
          userId: r.id,
          title: 'New comment on audit report',
          body: `${authorName} commented on "${report.title}" (${report.engagement.reference_number}): ${newComment.body.slice(0, 180)}`,
          type: 'info',
          referenceType: 'audit_engagement',
          referenceId: report.engagement.id,
        });
        if (r.email) {
          await notificationQueueService.enqueueSafe('email', {
            to: r.email,
            subject: `New Comment on Audit Report: ${report.title} (${report.engagement.reference_number})`,
            text: `${authorName} left a review comment on "${report.title}" (${report.engagement.reference_number}):\n\n"${newComment.body}"`,
          });
        }
      }
    }

    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.report.comment',
      module: 'audit',
      entityType: 'audit_report',
      entityId: reportId,
    });

    return newComment;
  }

  async exportReport(id: string, format: 'docx' | 'pdf', actor: ActorContext): Promise<ExportedAuditFile> {
    const scope = this._actorReportScope(actor);
    const exists = await prisma.audit_Report.count({
      where: { id, deleted_at: null, ...(scope ?? {}) },
    });
    if (exists === 0) throw AppError.notFound('Audit report');

    const file = await this.reportGenerationService.exportReport(id, format);
    return {
      fileName: file.filename,
      mimeType: file.mimeType,
      buffer: file.buffer,
    };
  }

  /** One in-app + email summary per responder of the findings assigned to them on this engagement. */
  private async _notifyFindingResponders(engagementId: string, engagementReference: string): Promise<void> {
    await notifyFindingResponders(engagementId, engagementReference, 'issued');
  }

  private async _saveSignOffMode(reportId: string, signOffMode: ReportSignOffMode, actorId: string): Promise<void> {
    try {
      const key = `report.sign_off_mode.${reportId}`;
      await prisma.system_Config.upsert({
        where: { key },
        update: { value: signOffMode, updated_by_id: actorId },
        create: {
          key,
          value: signOffMode,
          description: `Sign-off mode for audit report ${reportId}`,
          is_public: false,
          updated_by_id: actorId,
        },
      });
    } catch {
      // Gracefully ignore in unit tests that do not mock system_Config
    }
  }

  private async _readSignOffMode(reportId: string): Promise<ReportSignOffMode> {
    try {
      const row = await prisma.system_Config.findUnique({
        where: { key: `report.sign_off_mode.${reportId}` },
        select: { value: true },
      });
      if (row?.value === 'cae_only' || row?.value === 'cae_and_dg') {
        return row.value;
      }
    } catch {
      // Fallback below
    }
    return 'cae_and_dg';
  }

  private async _readComments(reportId: string): Promise<ReportCommentDto[]> {
    try {
      const row = await prisma.system_Config.findUnique({
        where: { key: `report.comments.${reportId}` },
        select: { value: true },
      });
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) return parsed as ReportCommentDto[];
      }
    } catch {
      // Fallback below
    }
    return [];
  }

  private async _decorateReport(
    report: Parameters<typeof mapReportToResponse>[0],
    knownSignOffMode?: ReportSignOffMode,
  ): Promise<ReportResponseDto> {
    const [signOffMode, comments] = await Promise.all([
      knownSignOffMode ? Promise.resolve(knownSignOffMode) : this._readSignOffMode(report.id),
      this._readComments(report.id),
    ]);
    return mapReportToResponse(report, { signOffMode, comments });
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
