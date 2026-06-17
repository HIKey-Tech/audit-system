import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { FindingStatus, VerificationStatus } from '../../../domain/enum/audit.enum';
import { assertHasPermission } from '../../../utility/audit.utility';
import {
  ManagementResponseRequestDto,
  VerifyRemediationRequestDto,
} from '../../dto/request/follow-up.request.dto';
import { FollowUpResponseDto, mapFollowUpToResponse } from '../../dto/response/follow-up.response.dto';
import { IFollowUpService } from '../interface/follow-up.service.interface';

export class FollowUpService implements IFollowUpService {
  constructor(private readonly documentService?: IDocumentService) {}

  async createFollowUp(findingId: string): Promise<FollowUpResponseDto> {
    const finding = await prisma.audit_Finding.findFirst({
      where: { id: findingId, deleted_at: null },
      select: { id: true },
    });
    if (!finding) throw AppError.notFound('Audit finding');

    const followUp = await prisma.audit_Follow_Up.upsert({
      where: { finding_id: findingId },
      create: { finding_id: findingId, verification_status: VerificationStatus.Pending },
      update: {},
    });
    auditLogService.logAsync({
      action: 'audit.follow_up.create',
      module: 'audit',
      entityType: 'audit_follow_up',
      entityId: followUp.id,
      newValues: { findingId },
    });
    return mapFollowUpToResponse(followUp);
  }

  async submitManagementResponse(findingId: string, dto: ManagementResponseRequestDto, actor: ActorContext): Promise<FollowUpResponseDto> {
    const finding = await this._getFinding(findingId);
    if (finding.auditee_id !== actor.id) throw AppError.forbidden('Only the assigned auditee can submit a management response');

    const followUp = await prisma.$transaction(async (tx) => {
      await tx.audit_Finding.update({
        where: { id: findingId },
        data: { status: FindingStatus.ManagementResponseReceived },
      });

      return tx.audit_Follow_Up.upsert({
        where: { finding_id: findingId },
        create: {
          finding_id: findingId,
          management_response: dto.managementResponse,
          management_response_by_id: actor.id,
          management_response_at: new Date(),
        },
        update: {
          management_response: dto.managementResponse,
          management_response_by_id: actor.id,
          management_response_at: new Date(),
        },
      });
    });

    logger.info('Management response submitted', { findingId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.follow_up.response.submit', module: 'audit', entityType: 'audit_follow_up', entityId: followUp.id });

    await this._notifyLeadAuditor(finding, {
      title: 'Management response submitted',
      body: `A management response was submitted for finding "${finding.title}" (${finding.engagement.reference_number}).`,
      type: 'info',
      eventKey: 'audit.followup.response.submitted',
    });

    return mapFollowUpToResponse(followUp);
  }

  async submitRemediationEvidence(findingId: string, evidenceId: string, actor: ActorContext): Promise<FollowUpResponseDto> {
    const finding = await this._getFinding(findingId);
    if (finding.auditee_id !== actor.id) throw AppError.forbidden('Only the assigned auditee can submit remediation evidence');

    const evidence = await prisma.audit_Evidence.findUnique({
      where: { id: evidenceId },
      select: { engagement_id: true },
    });
    if (!evidence) throw AppError.notFound('Audit evidence');
    if (evidence.engagement_id !== finding.engagement_id) throw AppError.badRequest('Evidence must belong to the same engagement as the finding');

    const followUp = await prisma.$transaction(async (tx) => {
      await tx.audit_Finding.update({
        where: { id: findingId },
        data: { status: FindingStatus.InRemediation },
      });

      return tx.audit_Follow_Up.upsert({
        where: { finding_id: findingId },
        create: {
          finding_id: findingId,
          remediation_evidence_id: evidenceId,
          verification_status: VerificationStatus.Pending,
        },
        update: {
          remediation_evidence_id: evidenceId,
          verification_status: VerificationStatus.Pending,
        },
      });
    });

    logger.info('Remediation evidence submitted', { findingId, evidenceId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.follow_up.evidence.submit', module: 'audit', entityType: 'audit_follow_up', entityId: followUp.id, newValues: { evidenceId } });

    await this._notifyLeadAuditor(finding, {
      title: 'Remediation awaiting verification',
      body: `Remediation evidence was submitted for finding "${finding.title}" (${finding.engagement.reference_number}) and is awaiting your verification.`,
      type: 'info',
      eventKey: 'audit.followup.evidence.submitted',
    });

    return mapFollowUpToResponse(followUp);
  }

  async uploadRemediationEvidence(
    findingId: string,
    file: { originalName: string; mimeType: string; fileSize: number; buffer: Buffer },
    actor: ActorContext,
  ): Promise<FollowUpResponseDto> {
    if (!this.documentService) throw AppError.internal('Document service is not configured for follow-up evidence upload');

    const finding = await this._getFinding(findingId);
    if (finding.auditee_id !== actor.id) throw AppError.forbidden('Only the assigned auditee can submit remediation evidence');

    const document = await this.documentService.upload({
      uploadedById: actor.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      buffer: file.buffer,
      module: 'audit',
      entityType: 'audit_follow_up_evidence',
      entityId: findingId,
    });

    const evidence = await prisma.audit_Evidence.create({
      data: {
        engagement_id: finding.engagement_id,
        finding_id: findingId,
        document_id: document.id,
        file_name: file.originalName,
        file_type: file.mimeType,
        uploaded_by_id: actor.id,
      },
    });

    logger.info('Remediation evidence uploaded', { findingId, evidenceId: evidence.id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'audit.follow_up.evidence.upload',
      module: 'audit',
      entityType: 'audit_follow_up',
      entityId: findingId,
      newValues: { evidenceId: evidence.id, documentId: document.id },
    });

    return this.submitRemediationEvidence(findingId, evidence.id, actor);
  }

  async verifyRemediation(findingId: string, dto: VerifyRemediationRequestDto, actor: ActorContext): Promise<FollowUpResponseDto> {
    assertHasPermission(actor.permissions, 'followup:verify');
    const finding = await this._getFinding(findingId);

    const followUp = await prisma.$transaction(async (tx) => {
      if (dto.verificationStatus === VerificationStatus.Verified) {
        await tx.audit_Finding.update({
          where: { id: findingId },
          data: { status: FindingStatus.Verified },
        });
      }

      return tx.audit_Follow_Up.update({
        where: { finding_id: findingId },
        data: {
          verification_status: dto.verificationStatus,
          verified_by_id: actor.id,
          verified_at: new Date(),
          verification_notes: dto.verificationNotes,
        },
      });
    });

    const isVerified = dto.verificationStatus === VerificationStatus.Verified;
    if (isVerified) {
      const [auditee, auditor] = await Promise.all([
        prisma.user.findUnique({
          where: { id: finding.auditee_id },
          select: { email: true, display_name: true, first_name: true, last_name: true },
        }),
        prisma.user.findUnique({
          where: { id: actor.id },
          select: { display_name: true, first_name: true, last_name: true },
        }),
      ]);

      const auditeeName = auditee?.display_name ?? `${auditee?.first_name ?? ''} ${auditee?.last_name ?? ''}`.trim();
      const auditorName = auditor?.display_name ?? `${auditor?.first_name ?? ''} ${auditor?.last_name ?? ''}`.trim();
      const verifiedVariables = {
        auditeeName,
        auditorName,
        findingTitle: finding.title,
        verificationNotes: dto.verificationNotes ?? '',
      };

      await notificationQueueService.enqueueSafe(
        'in_app',
        {
          userId: finding.auditee_id,
          title: 'Remediation verified',
          body: `Remediation for "${finding.title}" has been verified.`,
          type: 'success',
          referenceType: 'audit_finding',
          referenceId: findingId,
          eventKey: 'audit.followup.verified',
          variables: verifiedVariables,
        },
      );

      if (auditee?.email) {
        await notificationQueueService.enqueueSafe(
          'email',
          {
            to: auditee.email,
            subject: `Finding Verified: ${finding.title}`,
            text: `Remediation for "${finding.title}" has been verified.`,
            eventKey: 'audit.followup.verified',
            variables: verifiedVariables,
          },
        );
      }
    } else {
      const auditee = await prisma.user.findUnique({
        where: { id: finding.auditee_id },
        select: { email: true, display_name: true, first_name: true, last_name: true },
      });
      const auditeeName = auditee?.display_name ?? `${auditee?.first_name ?? ''} ${auditee?.last_name ?? ''}`.trim();
      const rejectedVariables = {
        auditeeName,
        findingTitle: finding.title,
        verificationNotes: dto.verificationNotes ?? '',
      };

      await notificationQueueService.enqueueSafe(
        'in_app',
        {
          userId: finding.auditee_id,
          title: 'Remediation rejected',
          body: `Remediation for "${finding.title}" was rejected. Please resubmit evidence.`,
          type: 'warning',
          referenceType: 'audit_finding',
          referenceId: findingId,
          eventKey: 'audit.followup.rejected',
          variables: rejectedVariables,
        },
      );

      if (auditee?.email) {
        await notificationQueueService.enqueueSafe(
          'email',
          {
            to: auditee.email,
            subject: `Remediation Rejected: ${finding.title}`,
            text: `Remediation for "${finding.title}" was rejected. Please resubmit evidence.`,
            eventKey: 'audit.followup.rejected',
            variables: rejectedVariables,
          },
        );
      }
    }

    logger.info('Remediation verification updated', { findingId, status: dto.verificationStatus, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.follow_up.verify', module: 'audit', entityType: 'audit_follow_up', entityId: followUp.id, newValues: dto });
    return mapFollowUpToResponse(followUp);
  }

  async getFollowUp(findingId: string): Promise<FollowUpResponseDto> {
    const followUp = await prisma.audit_Follow_Up.findUnique({
      where: { finding_id: findingId },
      include: { finding: true, remediation_evidence: true },
    });
    if (!followUp) throw AppError.notFound('Audit follow-up');
    return mapFollowUpToResponse(followUp);
  }

  async listPendingFollowUps(engagementId: string): Promise<FollowUpResponseDto[]> {
    const followUps = await prisma.audit_Follow_Up.findMany({
      where: {
        finding: { engagement_id: engagementId, deleted_at: null },
        verification_status: { in: [VerificationStatus.Pending, VerificationStatus.Rejected] },
      },
      include: { finding: true, remediation_evidence: true },
      orderBy: { updated_at: 'desc' },
    });
    return followUps.map(mapFollowUpToResponse);
  }

  private async _getFinding(findingId: string) {
    const finding = await prisma.audit_Finding.findFirst({
      where: { id: findingId, deleted_at: null },
      select: {
        id: true,
        engagement_id: true,
        auditee_id: true,
        title: true,
        engagement: {
          select: {
            reference_number: true,
            lead_auditor: {
              select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
            },
          },
        },
      },
    });
    if (!finding) throw AppError.notFound('Audit finding');
    return finding;
  }

  /**
   * Notify the engagement's lead auditor that an auditee has acted on a finding
   * (management response / remediation evidence). Post-commit and best-effort —
   * never throws into the caller.
   */
  private async _notifyLeadAuditor(
    finding: Awaited<ReturnType<FollowUpService['_getFinding']>>,
    notification: { title: string; body: string; type: 'info' | 'warning' | 'error' | 'success'; eventKey: string },
  ): Promise<void> {
    const lead = finding.engagement.lead_auditor;
    if (!lead) return;

    const recipientName = lead.display_name ?? `${lead.first_name} ${lead.last_name}`.trim();
    const variables = {
      recipientName,
      findingTitle: finding.title,
      engagementReference: finding.engagement.reference_number,
    };

    await notificationQueueService.enqueueSafe('in_app', {
      userId: lead.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      referenceType: 'audit_finding',
      referenceId: finding.id,
      eventKey: notification.eventKey,
      variables,
    });

    await notificationQueueService.enqueueSafe('email', {
      to: lead.email,
      subject: notification.title,
      text: notification.body,
      eventKey: notification.eventKey,
      variables,
    });
  }
}
