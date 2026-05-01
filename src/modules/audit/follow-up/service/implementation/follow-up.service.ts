import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { FindingStatus, VerificationStatus } from '../../../domain/enum/audit.enum';
import { AUDIT_REVIEW_ROLES, assertHasRole } from '../../../utility/audit.utility';
import {
  ManagementResponseRequestDto,
  VerifyRemediationRequestDto,
} from '../../dto/request/follow-up.request.dto';
import { FollowUpResponseDto, mapFollowUpToResponse } from '../../dto/response/follow-up.response.dto';
import { IFollowUpService } from '../interface/follow-up.service.interface';

export class FollowUpService implements IFollowUpService {
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
    return mapFollowUpToResponse(followUp);
  }

  async verifyRemediation(findingId: string, dto: VerifyRemediationRequestDto, actor: ActorContext): Promise<FollowUpResponseDto> {
    assertHasRole(actor.roles, AUDIT_REVIEW_ROLES);
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

      await notificationQueueService.enqueue(
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
        await notificationQueueService.enqueue(
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
      await notificationQueueService.enqueue(
        'in_app',
        {
          userId: finding.auditee_id,
          title: 'Remediation rejected',
          body: `Remediation for "${finding.title}" was rejected. Please resubmit evidence.`,
          type: 'warning',
          referenceType: 'audit_finding',
          referenceId: findingId,
        },
      );
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
      select: { id: true, engagement_id: true, auditee_id: true, title: true },
    });
    if (!finding) throw AppError.notFound('Audit finding');
    return finding;
  }
}
