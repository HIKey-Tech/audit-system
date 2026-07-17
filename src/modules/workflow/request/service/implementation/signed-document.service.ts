// src/modules/workflow/request/service/implementation/signed-document.service.ts
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { logger } from '../../../../../shared/utils/logger.util';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { DocumentService } from '../../../../document';
import {
  appendSignaturePage,
  buildCertificatePdf,
  SignaturePanelEntry,
  SignaturePageData,
} from '../../utility/signed-document.utility';
import {
  ISignedDocumentService,
  SignedDocumentSummary,
} from '../interface/signed-document.service.interface';

// Documents attached to a request are stored with this entity_type (see request.service.ts).
const ATTACHMENT_ENTITY_TYPE = 'workflow_request';
// Generated signed copies are stored under their own entity_type so they never mix with originals.
const SIGNED_ENTITY_TYPE = 'workflow_request_signed';

const generationInclude = Prisma.validator<Prisma.Workflow_RequestInclude>()({
  steps: { include: { recipient: true } },
  actions: true,
});

type RequestForGeneration = Prisma.Workflow_RequestGetPayload<{ include: typeof generationInclude }>;

export class SignedDocumentService implements ISignedDocumentService {
  constructor(private readonly documents: IDocumentService) {}

  async generateForCompletedRequest(requestId: string): Promise<void> {
    try {
      const request = await prisma.workflow_Request.findUnique({
        where: { id: requestId },
        include: generationInclude,
      });
      if (!request) return;

      const entries = await this._buildEntries(request);
      const manifestHash =
        [...request.actions].reverse().find((a) => a.action_type === 'sign')?.signature_hash ?? '—';

      const attachments = (
        await this.documents.listByEntity(ATTACHMENT_ENTITY_TYPE, requestId)
      ).filter((d) => d.mimeType === 'application/pdf');

      if (attachments.length === 0) {
        const bytes = await buildCertificatePdf({
          reference: request.reference_number,
          title: request.title,
          manifestHash,
          entries,
        });
        await this._store(requestId, null, request.reference_number, bytes, request.initiator_id);
        return;
      }

      for (const att of attachments) {
        try {
          const file = await this.documents.getFileById(att.id);
          const data: SignaturePageData = {
            reference: request.reference_number,
            title: request.title,
            manifestHash,
            fileChecksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
            entries,
          };
          const signed = await appendSignaturePage(file.buffer, data);
          await this._store(requestId, att.id, att.originalName, signed, request.initiator_id);
        } catch (err) {
          // Per-attachment isolation: a corrupt/encrypted PDF must not block the others.
          logger.warn('Signed-PDF generation failed for attachment', {
            requestId,
            documentId: att.id,
            err,
          });
        }
      }
    } catch (err) {
      logger.warn('Signed-PDF generation failed for request', { requestId, err });
      await this._notifyGenerationFailure(requestId);
    }
  }

  /** Fire-and-forget generation means failures are otherwise invisible — tell the initiator. Best-effort. */
  private async _notifyGenerationFailure(requestId: string): Promise<void> {
    try {
      const request = await prisma.workflow_Request.findUnique({
        where: { id: requestId },
        select: { initiator_id: true, reference_number: true },
      });
      if (!request) return;
      await notificationQueueService.enqueueSafe('in_app', {
        userId: request.initiator_id,
        title: 'Signed document generation failed',
        body: `Request ${request.reference_number} completed, but its signed PDF could not be generated. Contact an administrator — it can be regenerated once the underlying issue is resolved.`,
        type: 'error',
        referenceType: 'workflow_request',
        referenceId: requestId,
      });
    } catch (notifyErr) {
      logger.warn('Failed to notify signed-PDF generation failure', { requestId, notifyErr });
    }
  }

  async list(requestId: string): Promise<SignedDocumentSummary[]> {
    const rows = await prisma.workflow_Request_Signed_Document.findMany({
      where: { request_id: requestId },
      include: { source_document: true },
      orderBy: { generated_at: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      sourceName: r.source_document?.original_name ?? null,
      signedDocumentId: r.signed_document_id,
      downloadUrl: `/api/proxy/documents/${r.signed_document_id}/file`,
      generatedAt: r.generated_at.toISOString(),
    }));
  }

  private async _buildEntries(request: RequestForGeneration): Promise<SignaturePanelEntry[]> {
    const entries: SignaturePanelEntry[] = [];
    // Steps carry the canonical order/outcome; actions carry the signature_id used.
    const steps = [...request.steps].sort((a, b) => a.level - b.level);

    for (const step of steps) {
      if (step.status !== 'signed' && step.status !== 'approved') continue;
      const r = step.recipient;
      const name = r.display_name?.trim() || `${r.first_name} ${r.last_name}`.trim();
      const role = r.job_title ?? '';
      const actedAt = step.acted_at ?? new Date();

      if (step.status === 'signed') {
        const action = [...request.actions]
          .reverse()
          .find((a) => a.actor_id === step.recipient_id && a.action_type === 'sign');
        let signatureImage: SignaturePanelEntry['signatureImage'];
        if (action?.signature_id) {
          const sig = await prisma.user_Signature.findUnique({ where: { id: action.signature_id } });
          if (sig) {
            const file = await this.documents.getFileById(sig.document_id);
            signatureImage = {
              bytes: file.buffer,
              format: file.mimeType === 'image/jpeg' ? 'jpg' : 'png',
            };
          }
        }
        entries.push({ name, role, actedAt, action: 'signed', signatureImage });
      } else {
        entries.push({ name, role, actedAt, action: 'approved' });
      }
    }
    return entries;
  }

  private async _store(
    requestId: string,
    sourceId: string | null,
    baseName: string,
    bytes: Buffer,
    uploadedById: string,
  ): Promise<void> {
    const signedName = baseName.replace(/\.pdf$/i, '') + ' (signed).pdf';
    const doc = await this.documents.upload({
      uploadedById,
      originalName: signedName,
      mimeType: 'application/pdf',
      fileSize: bytes.length,
      buffer: bytes,
      module: 'workflow',
      entityType: SIGNED_ENTITY_TYPE,
      entityId: requestId,
    });
    await prisma.workflow_Request_Signed_Document.create({
      data: { request_id: requestId, source_document_id: sourceId, signed_document_id: doc.id },
    });
    logger.info('Signed document generated', { requestId, sourceId, signedDocumentId: doc.id });
  }
}

export const signedDocumentService = new SignedDocumentService(new DocumentService());
