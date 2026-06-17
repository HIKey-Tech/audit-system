// src/modules/audit/approval-signature/service/implementation/approval-signed-document.service.ts
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { logger } from '../../../../../shared/utils/logger.util';
import { DocumentService } from '../../../../document';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { reportTemplateService } from '../../../../settings/service/implementation/report-template.service';
import { systemConfigService } from '../../../../settings/service/implementation/system-config.service';
import { workingPaperTemplateService } from '../../../../settings/service/implementation/working-paper-template.service';
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
import {
  buildCertificatePdf,
  SignaturePanelEntry,
} from '../../../../workflow/request/utility/signed-document.utility';
import { ReportGenerationService } from '../../../report/service/implementation/report-generation.service';
import { WorkingPaperService } from '../../../working-papers/service/implementation/working-paper.service';
import { IApprovalSignedDocumentService } from '../interface/approval-signed-document.service.interface';

const SIGNED_ENTITY_TYPE = 'workflow_approval_signed';

export class ApprovalSignedDocumentService implements IApprovalSignedDocumentService {
  constructor(
    private readonly documents: IDocumentService = new DocumentService(),
    private readonly reportGen = new ReportGenerationService(
      reportTemplateService,
      systemConfigService,
      workflowApprovalService,
    ),
    private readonly workingPapers = new WorkingPaperService(new DocumentService(), workingPaperTemplateService),
  ) {}

  async generateForCompletedApproval(approvalId: string): Promise<void> {
    try {
      const approval = await prisma.workflow_Approval.findUnique({ where: { id: approvalId } });
      if (!approval || approval.status !== 'approved') return;

      const rendered = await this._renderForEntity(approval.entity_type, approval.entity_id);
      if (!rendered.bytes) return;

      const doc = await this.documents.upload({
        uploadedById: approval.submitted_by_id,
        originalName: rendered.baseName.replace(/\.pdf$/i, '') + ' (signed).pdf',
        mimeType: 'application/pdf',
        fileSize: rendered.bytes.length,
        buffer: rendered.bytes,
        module: 'workflow',
        entityType: SIGNED_ENTITY_TYPE,
        entityId: approvalId,
      });

      await prisma.workflow_Approval_Signed_Document.create({
        data: { approval_id: approvalId, signed_document_id: doc.id },
      });
      logger.info('Approval signed document generated', {
        approvalId,
        entityType: approval.entity_type,
        signedDocumentId: doc.id,
      });
    } catch (err) {
      logger.warn('Approval signed-document generation failed', { approvalId, err });
    }
  }

  private async _renderForEntity(
    entityType: string,
    entityId: string,
  ): Promise<{ bytes: Buffer | null; baseName: string }> {
    if (entityType === 'audit_report') {
      return { bytes: await this.reportGen.generatePdf(entityId), baseName: 'audit-report' };
    }
    if (entityType === 'audit_working_paper') {
      const out = await this.workingPapers.exportWorkingPaper(entityId, 'pdf');
      return { bytes: out.buffer, baseName: out.fileName };
    }
    // audit_plan | audit_finding_closure → standalone certificate (no source document)
    const { reference, title, entries } = await this._certificateData(entityType, entityId);
    return {
      bytes: await buildCertificatePdf({ reference, title, manifestHash: '—', entries }),
      baseName: title,
    };
  }

  private async _certificateData(
    entityType: string,
    entityId: string,
  ): Promise<{ reference: string; title: string; entries: SignaturePanelEntry[] }> {
    const approval = await prisma.workflow_Approval.findFirst({
      where: { entity_type: entityType, entity_id: entityId },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    const entries = approval ? await this._approverEntries(approval.id) : [];

    if (entityType === 'audit_plan') {
      const plan = await prisma.audit_Plan.findUnique({ where: { id: entityId }, select: { title: true } });
      return { reference: entityId.slice(0, 8), title: plan?.title ?? 'Audit Plan', entries };
    }
    const finding = await prisma.audit_Finding.findUnique({
      where: { id: entityId },
      select: { title: true, engagement: { select: { reference_number: true } } },
    });
    return {
      reference: finding?.engagement.reference_number ?? entityId.slice(0, 8),
      title: finding?.title ?? 'Finding Closure',
      entries,
    };
  }

  /** Signature-panel entries from approved steps, embedding each approver's recorded signature image. */
  private async _approverEntries(approvalId: string): Promise<SignaturePanelEntry[]> {
    const steps = await prisma.workflow_Approval_Step.findMany({
      where: { approval_id: approvalId, status: 'approved' },
      include: { approver: true },
      orderBy: { level: 'asc' },
    });

    const entries: SignaturePanelEntry[] = [];
    for (const s of steps) {
      if (!s.approver) continue;
      const name =
        s.approver.display_name?.trim() || `${s.approver.first_name} ${s.approver.last_name}`.trim();
      const role = s.approver.job_title ?? '';
      const actedAt = s.acted_at ?? new Date();

      let signatureImage: SignaturePanelEntry['signatureImage'];
      if (s.signature_id) {
        const sig = await prisma.user_Signature.findUnique({ where: { id: s.signature_id } });
        if (sig) {
          const file = await this.documents.getFileById(sig.document_id);
          signatureImage = {
            bytes: file.buffer,
            format: file.mimeType === 'image/jpeg' ? 'jpg' : 'png',
          };
        }
      }
      entries.push({ name, role, actedAt, action: 'signed', signatureImage });
    }
    return entries;
  }
}

export const approvalSignedDocumentService = new ApprovalSignedDocumentService();
