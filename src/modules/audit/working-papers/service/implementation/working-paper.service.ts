import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IWorkingPaperTemplateService } from '../../../../settings/service/interface/working-paper-template.service.interface';
import { workingPaperTemplateService } from '../../../../settings/service/implementation/working-paper-template.service';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
import { WorkflowEntityType } from '../../../../workflow/domain/enum/workflow.enum';
import { ActorContext, ExportedAuditFile } from '../../../domain/entity/audit.entity';
import { EngagementStatus, WorkingPaperStatus } from '../../../domain/enum/audit.enum';
import { WP_REVIEWABLE_STATUSES, assertHasPermission } from '../../../utility/audit.utility';
import { assertCanViewInternalArtifacts } from '../../../engagement/utility/engagement-visibility.util';
import {
  CreateWorkingPaperRequestDto,
  ImportWorkingPaperMetadataDto,
  UpdateWorkingPaperRequestDto,
} from '../../dto/request/working-paper.request.dto';
import {
  WorkingPaperImportPreviewResponseDto,
  WorkingPaperResponseDto,
  mapWorkingPaperToResponse,
} from '../../dto/response/working-paper.response.dto';
import {
  IWorkingPaperService,
  WorkingPaperExportFormat,
  WorkingPaperImportFileDto,
} from '../interface/working-paper.service.interface';
import {
  averageSectionConfidence,
  buildWorkingPaperContentFromSections,
  extractWorkingPaperText,
  mapTextToWorkingPaperSections,
  truncateExtractedText,
} from '../../utility/working-paper-import.utility';
import {
  WorkingPaperPdfData,
  WorkingPaperSignOff,
  buildWorkingPaperDocDefinition,
  parseWorkingPaperSections,
} from '../../utility/working-paper.utility';
import { renderPdf } from '../../../../../shared/utils/pdf.util';

export class WorkingPaperService implements IWorkingPaperService {
  constructor(
    private readonly documentService: IDocumentService,
    private readonly templateService: IWorkingPaperTemplateService = workingPaperTemplateService,
    private readonly approvalService: IApprovalService = workflowApprovalService,
  ) {}

  async createWorkingPaper(engagementId: string, dto: CreateWorkingPaperRequestDto, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    assertHasPermission(actor.permissions, 'working_paper:create');
    await this._assertEngagementInProgress(engagementId);
    await this._assertOptionalImportReferences(dto.templateId, dto.sourceDocumentId);

    const paper = await prisma.audit_Working_Paper.create({
      data: {
        engagement_id: engagementId,
        template_id: dto.templateId ?? null,
        source_document_id: dto.sourceDocumentId ?? null,
        working_paper_type: dto.workingPaperType ?? 'general',
        title: dto.title,
        content: dto.content,
        import_metadata: dto.importMetadata ? JSON.stringify(dto.importMetadata) : null,
        created_by_id: actor.id,
      },
    });

    logger.info('Audit working paper created', { workingPaperId: paper.id, engagementId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.create', module: 'audit', entityType: 'audit_working_paper', entityId: paper.id });
    return mapWorkingPaperToResponse(paper);
  }

  async previewWorkingPaperImport(
    engagementId: string,
    file: WorkingPaperImportFileDto,
    dto: ImportWorkingPaperMetadataDto,
    actor: ActorContext,
  ): Promise<WorkingPaperImportPreviewResponseDto> {
    assertHasPermission(actor.permissions, 'working_paper:create');
    const engagement = await this._getEngagementForWorkingPaperImport(engagementId);

    const extracted = await extractWorkingPaperText(file.buffer, file.mimeType, file.originalName);
    const template = await this._resolveImportTemplate(dto.templateId, engagement.audit_type);
    const mappedSections = template
      ? mapTextToWorkingPaperSections(extracted.text, template.sections)
      : [];
    const content = mappedSections.length > 0
      ? buildWorkingPaperContentFromSections(mappedSections)
      : extracted.text;
    const confidence = mappedSections.length > 0 ? averageSectionConfidence(mappedSections) : 0.35;
    const matchedSectionCount = mappedSections.filter((section) => section.content.trim().length > 0).length;

    const document = await this.documentService.upload({
      uploadedById: actor.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      buffer: file.buffer,
      module: 'audit',
      entityType: 'audit_working_paper_source',
      entityId: engagementId,
    });

    const suggestedTitle = this._suggestTitle(file.originalName, template?.name);
    const warnings = [...extracted.warnings];
    if (!template) {
      warnings.push('No working paper template matched this engagement. The extracted text was returned as free-form content.');
    }
    if (!extracted.text.trim()) {
      warnings.push('The file was read, but no usable text was extracted. Scanned PDFs or image-only documents may require OCR before import.');
    }
    if (template && matchedSectionCount === 0) {
      warnings.push('No template section headings were detected in the uploaded file. Use headings like Objective, Test Steps, Evidence, Results, and Conclusion, or copy the extracted text into the expected sections below.');
    }
    if (confidence < 0.5) {
      warnings.push('Low section-mapping confidence. Review and edit the preview before saving.');
    }

    logger.info('Audit working paper import preview generated', {
      engagementId,
      documentId: document.id,
      templateId: template?.id ?? null,
      actorId: actor.id,
    });

    return {
      documentId: document.id,
      fileName: file.originalName,
      fileType: file.mimeType,
      templateId: template?.id ?? null,
      templateName: template?.name ?? null,
      workingPaperType: dto.workingPaperType ?? 'imported',
      suggestedTitle,
      extractedText: truncateExtractedText(extracted.text),
      mappedSections,
      content,
      confidence,
      warnings,
    };
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

    const { updated, approval } = await prisma.$transaction(async (tx) => {
      const updated = await tx.audit_Working_Paper.update({
        where: { id },
        data: { status: WorkingPaperStatus.Submitted, rejection_reason: null },
      });

      const approval = await this.approvalService.createApproval({
        entityType: WorkflowEntityType.AuditWorkingPaper,
        entityId: id,
      }, actor, tx);

      return { updated, approval };
    }, { timeout: 15000 });
    this.approvalService.queueApprovalRequiredNotification(approval);

    logger.info('Audit working paper submitted', { workingPaperId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.submit', module: 'audit', entityType: 'audit_working_paper', entityId: id });
    return mapWorkingPaperToResponse(updated);
  }

  async approveWorkingPaper(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    assertHasPermission(actor.permissions, 'working_paper:approve');
    const paper = await this._getPaper(id);
    if (paper.status !== WorkingPaperStatus.Submitted) throw AppError.badRequest('Only submitted working papers can be approved');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditWorkingPaper, id);
    await this.approvalService.approve(approval.id, actor);
    const updated = await this._getPaper(id);

    logger.info('Audit working paper approved', { workingPaperId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.approve', module: 'audit', entityType: 'audit_working_paper', entityId: id });
    return mapWorkingPaperToResponse(updated);
  }

  async rejectWorkingPaper(id: string, reason: string, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    assertHasPermission(actor.permissions, 'working_paper:reject');
    const paper = await this._getPaper(id);
    if (paper.status !== WorkingPaperStatus.Submitted) throw AppError.badRequest('Only submitted working papers can be rejected');

    const approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditWorkingPaper, id);
    await this.approvalService.reject(approval.id, actor, reason);
    const updated = await this._getPaper(id);

    logger.info('Audit working paper rejected', { workingPaperId: id, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.reject', module: 'audit', entityType: 'audit_working_paper', entityId: id, newValues: { reason } });
    return mapWorkingPaperToResponse(updated);
  }

  async getWorkingPaperById(id: string, actor: ActorContext): Promise<WorkingPaperResponseDto> {
    const paper = await prisma.audit_Working_Paper.findFirst({
      where: { id, deleted_at: null },
      include: { evidence: true },
    });
    if (!paper) throw AppError.notFound('Audit working paper');
    await assertCanViewInternalArtifacts(paper.engagement_id, actor);
    return mapWorkingPaperToResponse(paper);
  }

  async listWorkingPapers(engagementId: string, actor: ActorContext): Promise<WorkingPaperResponseDto[]> {
    await assertCanViewInternalArtifacts(engagementId, actor);
    const papers = await prisma.audit_Working_Paper.findMany({
      where: { engagement_id: engagementId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
    });
    return papers.map(mapWorkingPaperToResponse);
  }

  async exportWorkingPaper(id: string, format: WorkingPaperExportFormat): Promise<ExportedAuditFile> {
    const paper = await prisma.audit_Working_Paper.findFirst({
      where: { id, deleted_at: null },
      include: {
        engagement: { select: { reference_number: true, title: true } },
        created_by: { select: { display_name: true, email: true } },
      },
    });
    if (!paper) throw AppError.notFound('Audit working paper');

    if (paper.status !== WorkingPaperStatus.Approved) {
      throw AppError.badRequest('Only approved working papers can be exported');
    }

    const auditorName = paper.created_by.display_name || paper.created_by.email;
    const exportDate = new Date().toISOString().slice(0, 10);
    const slug = paper.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

    const buffer =
      format === 'pdf'
        ? await this._renderWorkingPaperPdf({
            title: paper.title,
            engagementReference: paper.engagement.reference_number,
            engagementTitle: paper.engagement.title,
            workingPaperType: paper.working_paper_type,
            auditorName,
            status: paper.status,
            version: String(paper.version_number),
            date: exportDate,
            sections: parseWorkingPaperSections(paper.content),
            signOff: await this._buildSignOff(id),
          })
        : await this.documentService.renderDocxTemplate('working_paper', {
            title: paper.title,
            engagementReference: paper.engagement.reference_number,
            engagementTitle: paper.engagement.title,
            auditorName,
            date: exportDate,
            status: paper.status,
            version: String(paper.version_number),
            content: paper.content,
          });

    logger.info('Working paper exported', { workingPaperId: id, format });

    return {
      fileName: `${slug}-working-paper.${format}`,
      mimeType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer,
    };
  }

  /** Build sign-off entries (approver name/role/date + signature image) from the WP's approval. */
  private async _buildSignOff(workingPaperId: string): Promise<WorkingPaperSignOff[]> {
    let approval;
    try {
      approval = await this.approvalService.getApprovalByEntity(
        WorkflowEntityType.AuditWorkingPaper,
        workingPaperId,
      );
    } catch {
      return [];
    }

    const out: WorkingPaperSignOff[] = [];
    for (const step of approval.steps ?? []) {
      if (step.status !== 'approved' || !step.approver) continue;
      let imageDataUrl: string | undefined;
      if (step.signatureId) {
        try {
          const sig = await prisma.user_Signature.findUnique({ where: { id: step.signatureId } });
          if (sig) {
            const file = await this.documentService.getFileById(sig.document_id);
            imageDataUrl = `data:${file.mimeType};base64,${file.buffer.toString('base64')}`;
          }
        } catch {
          // Skip this approver's image; the text entry still renders.
        }
      }
      out.push({
        name: step.approver.displayName ?? '',
        role: step.approver.jobTitle ?? '',
        date: step.actedAt ? step.actedAt.slice(0, 10) : '',
        imageDataUrl,
      });
    }
    return out;
  }

  private async _renderWorkingPaperPdf(data: WorkingPaperPdfData): Promise<Buffer> {
    return renderPdf(buildWorkingPaperDocDefinition(data));
  }

  private async _assertEngagementInProgress(engagementId: string): Promise<void> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { status: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    if (engagement.status !== EngagementStatus.InProgress) throw AppError.badRequest('Engagement must be in progress');
  }

  private async _getEngagementForWorkingPaperImport(engagementId: string): Promise<{ audit_type: string }> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { status: true, audit_type: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    if (engagement.status !== EngagementStatus.InProgress) throw AppError.badRequest('Engagement must be in progress');
    return { audit_type: engagement.audit_type };
  }

  private async _resolveImportTemplate(templateId: string | undefined, auditType: string) {
    if (templateId) return this.templateService.getTemplateById(templateId);

    try {
      return await this.templateService.getDefaultTemplate(auditType as never);
    } catch {
      try {
        return await this.templateService.getDefaultTemplate('all' as never);
      } catch {
        return null;
      }
    }
  }

  private async _assertOptionalImportReferences(templateId?: string, sourceDocumentId?: string): Promise<void> {
    if (templateId) {
      const template = await prisma.working_Paper_Template.findFirst({
        where: { id: templateId, deleted_at: null, is_active: true },
        select: { id: true },
      });
      if (!template) throw AppError.notFound('Working paper template');
    }

    if (sourceDocumentId) {
      const document = await prisma.document.findFirst({
        where: { id: sourceDocumentId, deleted_at: null },
        select: { id: true },
      });
      if (!document) throw AppError.notFound('Source document');
    }
  }

  private _suggestTitle(originalName: string, templateName?: string | null): string {
    const baseName = originalName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (baseName) return baseName.slice(0, 200);
    return (templateName ? `${templateName} Import` : 'Imported working paper').slice(0, 200);
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
