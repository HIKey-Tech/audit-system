import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
import { WorkflowEntityType } from '../../../../workflow/domain/enum/workflow.enum';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { EngagementStatus, WorkingPaperStatus } from '../../../domain/enum/audit.enum';
import { AUDIT_REVIEW_ROLES, AUDIT_WORK_ROLES, WP_REVIEWABLE_STATUSES, assertHasRole } from '../../../utility/audit.utility';
import {
  CreateWorkingPaperRequestDto,
  UpdateWorkingPaperRequestDto,
} from '../../dto/request/working-paper.request.dto';
import { WorkingPaperResponseDto, mapWorkingPaperToResponse } from '../../dto/response/working-paper.response.dto';
import { IWorkingPaperService } from '../interface/working-paper.service.interface';

export class WorkingPaperService implements IWorkingPaperService {
  constructor(
    private readonly documentService: IDocumentService,
    private readonly approvalService: IApprovalService = workflowApprovalService,
  ) {}

  async createWorkingPaper(engagementId: string, dto: CreateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    assertHasRole(actor.roles, AUDIT_WORK_ROLES);
    await this._assertEngagementInProgress(engagementId);

    const paper = await prisma.audit_Working_Paper.create({
      data: {
        engagement_id: engagementId,
        title: dto.title,
        content: dto.content,
        created_by_id: actor.id,
      },
    });

    logger.info('Audit working paper created', { workingPaperId: paper.id, engagementId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.create', module: 'audit', entityType: 'audit_working_paper', entityId: paper.id });
    return mapWorkingPaperToResponse(paper);
  }

  async updateWorkingPaper(id: string, dto: UpdateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    const paper = await this._getPaper(id);
    if (paper.created_by_id !== actor.id) throw AppError.forbidden('Only the creator can update this working paper');
    if (!WP_REVIEWABLE_STATUSES.includes(paper.status as WorkingPaperStatus)) {
      throw AppError.badRequest('Only draft or rejected working papers can be updated');
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

    const updated = await prisma.audit_Working_Paper.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        version_number: { increment: 1 },
        status: WorkingPaperStatus.Draft,
        rejection_reason: null,
      },
    });

    logger.info('Audit working paper updated', { workingPaperId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.update', module: 'audit', entityType: 'audit_working_paper', entityId: id });
    return mapWorkingPaperToResponse(updated);
  }

  async submitWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    const paper = await this._getPaperWithEngagement(id);
    if (paper.created_by_id !== actor.id) throw AppError.forbidden('Only the creator can submit this working paper');
    if (!WP_REVIEWABLE_STATUSES.includes(paper.status as WorkingPaperStatus)) {
      throw AppError.badRequest('Only draft or rejected working papers can be submitted');
    }

    const updated = await prisma.audit_Working_Paper.update({
      where: { id },
      data: { status: WorkingPaperStatus.Submitted, rejection_reason: null },
    });

    await this.approvalService.createApproval({
      entityType: WorkflowEntityType.AuditWorkingPaper,
      entityId: id,
    }, actor);

    logger.info('Audit working paper submitted', { workingPaperId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.submit', module: 'audit', entityType: 'audit_working_paper', entityId: id });
    return mapWorkingPaperToResponse(updated);
  }

  async approveWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    assertHasRole(actor.roles, AUDIT_REVIEW_ROLES);
    const paper = await this._getPaper(id);
    if (paper.status !== WorkingPaperStatus.Submitted) throw AppError.badRequest('Only submitted working papers can be approved');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditWorkingPaper, id);
    await this.approvalService.approve(approval.id, actor.id);
    const updated = await this._getPaper(id);

    logger.info('Audit working paper approved', { workingPaperId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.approve', module: 'audit', entityType: 'audit_working_paper', entityId: id });
    return mapWorkingPaperToResponse(updated);
  }

  async rejectWorkingPaper(id: string, reason: string, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    assertHasRole(actor.roles, AUDIT_REVIEW_ROLES);
    const paper = await this._getPaper(id);
    if (paper.status !== WorkingPaperStatus.Submitted) throw AppError.badRequest('Only submitted working papers can be rejected');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditWorkingPaper, id);
    await this.approvalService.reject(approval.id, actor.id, reason);
    const updated = await this._getPaper(id);

    logger.info('Audit working paper rejected', { workingPaperId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.reject', module: 'audit', entityType: 'audit_working_paper', entityId: id, newValues: { reason } });
    return mapWorkingPaperToResponse(updated);
  }

  async getWorkingPaperById(id: string): Promise<WorkingPaperResponseDto> {
    const paper = await prisma.audit_Working_Paper.findFirst({
      where: { id, deleted_at: null },
      include: { evidence: true },
    });
    if (!paper) throw AppError.notFound('Audit working paper');
    return mapWorkingPaperToResponse(paper);
  }

  async listWorkingPapers(engagementId: string): Promise<WorkingPaperResponseDto[]> {
    const papers = await prisma.audit_Working_Paper.findMany({
      where: { engagement_id: engagementId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
    });
    return papers.map(mapWorkingPaperToResponse);
  }

  async exportWorkingPaper(id: string): Promise<ExportedAuditFile> {
    const paper = await prisma.audit_Working_Paper.findFirst({
      where: { id, deleted_at: null },
      include: {
        engagement: { select: { reference_number: true, title: true } },
        created_by: { select: { display_name: true, email: true } },
      },
    });
    if (!paper) throw AppError.notFound('Audit working paper');

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

  private async _assertEngagementInProgress(engagementId: string): Promise<void> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { status: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    if (engagement.status !== EngagementStatus.InProgress) throw AppError.badRequest('Engagement must be in progress');
  }

  private async _getPaper(id: string) {
    const paper = await prisma.audit_Working_Paper.findFirst({ where: { id, deleted_at: null } });
    if (!paper) throw AppError.notFound('Audit working paper');
    return paper;
  }

  private async _getPaperWithEngagement(id: string) {
    const paper = await prisma.audit_Working_Paper.findFirst({
      where: { id, deleted_at: null },
      include: { engagement: true },
    });
    if (!paper) throw AppError.notFound('Audit working paper');
    return paper;
  }
}
