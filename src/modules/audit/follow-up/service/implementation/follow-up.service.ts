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
    this._assertResponder(finding, actor.id);

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
    this._assertResponder(finding, actor.id);

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
    this._assertResponder(finding, actor.id);

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

    if (!actor.permissions.includes('engagement:read_all')) {
      const allowed = await prisma.audit_Engagement.count({
        where: {
          id: finding.engagement_id,
          deleted_at: null,
          OR: [
            { lead_auditor_id: actor.id },
            { audit_manager_id: actor.id },
            { workflow_assignments: { some: { user_id: actor.id } } },
          ],
        },
      }) > 0;
      if (!allowed) throw AppError.forbidden('Only the assigned audit team can verify remediation');
    }

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
    // Notify the primary auditee and every co-responder.
    const recipients = this._responders(finding);
    if (isVerified) {
      const auditor = await prisma.user.findUnique({
        where: { id: actor.id },
        select: { display_name: true, first_name: true, last_name: true },
      });
      const auditorName = auditor?.display_name ?? `${auditor?.first_name ?? ''} ${auditor?.last_name ?? ''}`.trim();

      for (const recipient of recipients) {
        const auditeeName = recipient.display_name ?? `${recipient.first_name} ${recipient.last_name}`.trim();
        const verifiedVariables = {
          auditeeName,
          auditorName,
          findingTitle: finding.title,
          verificationNotes: dto.verificationNotes ?? '',
        };

        await notificationQueueService.enqueueSafe('in_app', {
          userId: recipient.id,
          title: 'Remediation verified',
          body: `Remediation for "${finding.title}" has been verified.`,
          type: 'success',
          referenceType: 'audit_finding',
          referenceId: findingId,
          eventKey: 'audit.followup.verified',
          variables: verifiedVariables,
        });

        if (recipient.email) {
          await notificationQueueService.enqueueSafe('email', {
            to: recipient.email,
            subject: `Finding Verified: ${finding.title}`,
            text: `Remediation for "${finding.title}" has been verified.`,
            eventKey: 'audit.followup.verified',
            variables: verifiedVariables,
          });
        }
      }
    } else {
      for (const recipient of recipients) {
        const auditeeName = recipient.display_name ?? `${recipient.first_name} ${recipient.last_name}`.trim();
        const rejectedVariables = {
          auditeeName,
          findingTitle: finding.title,
          verificationNotes: dto.verificationNotes ?? '',
        };

        await notificationQueueService.enqueueSafe('in_app', {
          userId: recipient.id,
          title: 'Remediation rejected',
          body: `Remediation for "${finding.title}" was rejected. Please resubmit evidence.`,
          type: 'warning',
          referenceType: 'audit_finding',
          referenceId: findingId,
          eventKey: 'audit.followup.rejected',
          variables: rejectedVariables,
        });

        if (recipient.email) {
          await notificationQueueService.enqueueSafe('email', {
            to: recipient.email,
            subject: `Remediation Rejected: ${finding.title}`,
            text: `Remediation for "${finding.title}" was rejected. Please resubmit evidence.`,
            eventKey: 'audit.followup.rejected',
            variables: rejectedVariables,
          });
        }
      }
    }

    // Close the risk loop: a verified finding is new evidence about the risk
    // picture of the audited entity. Nudge the owners of related risks (the
    // finding's directly-linked risk plus risks tied to the engagement's
    // universe entity) to reassess. Fire-and-forget — never blocks verification.
    if (isVerified) {
      void this._suggestRiskReassessment(findingId, finding.title, finding.engagement_id).catch((err: unknown) =>
        logger.warn('Risk reassessment suggestion failed', { findingId, err }),
      );
    }

    logger.info('Remediation verification updated', { findingId, status: dto.verificationStatus, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.follow_up.verify', module: 'audit', entityType: 'audit_follow_up', entityId: followUp.id, newValues: dto });
    return mapFollowUpToResponse(followUp);
  }

  /** Notify the owners of risks related to a just-verified finding that a reassessment may be due. */
  private async _suggestRiskReassessment(
    findingId: string,
    findingTitle: string,
    engagementId: string,
  ): Promise<void> {
    const [finding, engagement] = await Promise.all([
      prisma.audit_Finding.findUnique({ where: { id: findingId }, select: { risk_id: true } }),
      prisma.audit_Engagement.findUnique({
        where: { id: engagementId },
        select: { universe_id: true, universe: { select: { name: true } } },
      }),
    ]);
    if (!engagement) return;

    const risks = await prisma.risk_Register.findMany({
      where: {
        deleted_at: null,
        OR: [
          ...(finding?.risk_id ? [{ id: finding.risk_id }] : []),
          { universe_id: engagement.universe_id },
        ],
      },
      select: {
        id: true,
        title: true,
        owner: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } },
      },
    });

    for (const risk of risks) {
      const ownerName =
        risk.owner.display_name ?? `${risk.owner.first_name} ${risk.owner.last_name}`.trim();
      const variables = {
        ownerName,
        riskTitle: risk.title,
        findingTitle,
        entityName: engagement.universe.name,
      };

      await notificationQueueService.enqueueSafe('in_app', {
        userId: risk.owner.id,
        title: 'Risk reassessment suggested',
        body: `Finding "${findingTitle}" affecting ${engagement.universe.name} was verified — consider reassessing risk "${risk.title}".`,
        type: 'info',
        referenceType: 'risk_register',
        referenceId: risk.id,
        eventKey: 'risk.reassessment.suggested',
        variables,
      });

      if (risk.owner.email) {
        await notificationQueueService.enqueueSafe('email', {
          to: risk.owner.email,
          subject: `Risk reassessment suggested: ${risk.title}`,
          text: `Audit finding "${findingTitle}" affecting ${engagement.universe.name} has been verified. Consider reassessing risk "${risk.title}" in the risk register.`,
          eventKey: 'risk.reassessment.suggested',
          variables,
        });
      }
    }
  }

  async getFollowUp(findingId: string, actor: ActorContext): Promise<FollowUpResponseDto> {
    const followUp = await prisma.audit_Follow_Up.findUnique({
      where: { finding_id: findingId },
      include: {
        finding: {
          include: {
            responders: { select: { user_id: true } }
          }
        },
        remediation_evidence: true,
        verified_by: { select: { display_name: true, first_name: true, last_name: true } },
      },
    });
    if (!followUp || followUp.finding.deleted_at !== null) throw AppError.notFound('Audit follow-up');

    const isOversight = actor.permissions.includes('finding:read_all');
    const isTeamOrResponder =
      isOversight ||
      followUp.finding.created_by_id === actor.id ||
      followUp.finding.auditee_id === actor.id ||
      followUp.finding.responders.some((r) => r.user_id === actor.id) ||
      (await prisma.audit_Engagement.count({
        where: {
          id: followUp.finding.engagement_id,
          deleted_at: null,
          OR: [
            { lead_auditor_id: actor.id },
            { audit_manager_id: actor.id },
            { workflow_assignments: { some: { user_id: actor.id } } },
          ],
        },
      })) > 0;

    if (!isTeamOrResponder) throw AppError.notFound('Audit follow-up');

    return mapFollowUpToResponse(followUp);
  }

  async listPendingFollowUps(engagementId: string, actor: ActorContext): Promise<FollowUpResponseDto[]> {
    const allowed =
      actor.permissions.includes('engagement:read_all') ||
      (await prisma.audit_Engagement.count({
        where: {
          id: engagementId,
          deleted_at: null,
          OR: [
            { lead_auditor_id: actor.id },
            { audit_manager_id: actor.id },
            { auditee_id: actor.id },
            { workflow_assignments: { some: { user_id: actor.id } } },
          ],
        },
      })) > 0;
    if (!allowed) throw AppError.notFound('Audit engagement');

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
    const responderSelect = { id: true, email: true, display_name: true, first_name: true, last_name: true };
    const finding = await prisma.audit_Finding.findFirst({
      where: { id: findingId, deleted_at: null },
      select: {
        id: true,
        engagement_id: true,
        auditee_id: true,
        title: true,
        auditee: { select: responderSelect },
        responders: { select: { user: { select: responderSelect } } },
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

  /** A finding may be acted on by its primary auditee or any co-responder. */
  private _assertResponder(finding: Awaited<ReturnType<FollowUpService['_getFinding']>>, actorId: string): void {
    const allowed = finding.auditee_id === actorId || finding.responders.some((r) => r.user.id === actorId);
    if (!allowed) throw AppError.forbidden('Only an assigned auditee can submit a response for this finding');
  }

  /** Primary auditee plus co-responders, de-duplicated by user id. */
  private _responders(finding: Awaited<ReturnType<FollowUpService['_getFinding']>>) {
    const all = [finding.auditee, ...finding.responders.map((r) => r.user)];
    return all.filter((u, i) => all.findIndex((o) => o.id === u.id) === i);
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
