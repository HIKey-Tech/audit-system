import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EngagementStatus } from '../../../domain/enum/audit.enum';
import { assertHasPermission } from '../../../utility/audit.utility';
import { EvidenceQueryDto, UploadEvidenceDto } from '../../dto/request/evidence.request.dto';
import { EvidenceResponseDto, mapEvidenceToResponse } from '../../dto/response/evidence.response.dto';
import { IEvidenceService } from '../interface/evidence.service.interface';

export class EvidenceService implements IEvidenceService {
  constructor(private readonly documentService: IDocumentService) {}

  async uploadEvidence(engagementId: string, file: UploadEvidenceDto, actor: ActorContext): Promise<EvidenceResponseDto> {
    assertHasPermission(actor.permissions, 'evidence:upload');
    await this._assertEngagementInProgress(engagementId);

    if (file.workingPaperId) {
      await this._assertWorkingPaperInEngagement(file.workingPaperId, engagementId);
    }
    if (file.findingId) {
      await this._assertFindingInEngagement(file.findingId, engagementId);
    }

    const document = await this.documentService.upload({
      uploadedById: actor.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      buffer: file.buffer,
      module: 'audit',
      entityType: 'audit_engagement',
      entityId: engagementId,
    });

    const evidence = await prisma.audit_Evidence.create({
      data: {
        engagement_id: engagementId,
        working_paper_id: file.workingPaperId,
        finding_id: file.findingId,
        document_id: document.id,
        file_name: file.originalName,
        file_type: file.mimeType,
        uploaded_by_id: actor.id,
      },
    });

    logger.info('Audit evidence uploaded', { evidenceId: evidence.id, engagementId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.upload', module: 'audit', entityType: 'audit_evidence', entityId: evidence.id });
    return mapEvidenceToResponse(evidence);
  }

  async linkToWorkingPaper(evidenceId: string, workingPaperId: string, actor: ActorContext): Promise<EvidenceResponseDto> {
    assertHasPermission(actor.permissions, 'evidence:upload');
    const evidence = await this._getEvidence(evidenceId);
    const paper = await prisma.audit_Working_Paper.findFirst({
      where: { id: workingPaperId, deleted_at: null },
      select: { engagement_id: true },
    });
    if (!paper) throw AppError.notFound('Audit working paper');
    if (paper.engagement_id !== evidence.engagement_id) throw AppError.badRequest('Evidence and working paper must belong to the same engagement');

    const updated = await prisma.audit_Evidence.update({ where: { id: evidenceId }, data: { working_paper_id: workingPaperId } });
    logger.info('Evidence linked to working paper', { evidenceId, workingPaperId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.link_working_paper', module: 'audit', entityType: 'audit_evidence', entityId: evidenceId, newValues: { workingPaperId } });
    return mapEvidenceToResponse(updated);
  }

  async linkToFinding(evidenceId: string, findingId: string, actor: ActorContext): Promise<EvidenceResponseDto> {
    assertHasPermission(actor.permissions, 'evidence:upload');
    const evidence = await this._getEvidence(evidenceId);
    const finding = await prisma.audit_Finding.findFirst({
      where: { id: findingId, deleted_at: null },
      select: { engagement_id: true },
    });
    if (!finding) throw AppError.notFound('Audit finding');
    if (finding.engagement_id !== evidence.engagement_id) throw AppError.badRequest('Evidence and finding must belong to the same engagement');

    const updated = await prisma.audit_Evidence.update({ where: { id: evidenceId }, data: { finding_id: findingId } });
    logger.info('Evidence linked to finding', { evidenceId, findingId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.link_finding', module: 'audit', entityType: 'audit_evidence', entityId: evidenceId, newValues: { findingId } });
    return mapEvidenceToResponse(updated);
  }

  async disputeEvidence(evidenceId: string, reason: string, actor: ActorContext): Promise<EvidenceResponseDto> {
    assertHasPermission(actor.permissions, 'evidence:dispute');
    await this._getEvidence(evidenceId);

    const updated = await prisma.audit_Evidence.update({
      where: { id: evidenceId },
      data: { is_disputed: true, dispute_reason: reason },
    });

    logger.info('Evidence disputed', { evidenceId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence.dispute', module: 'audit', entityType: 'audit_evidence', entityId: evidenceId, newValues: { reason } });
    return mapEvidenceToResponse(updated);
  }

  async listEvidence(engagementId: string, query: EvidenceQueryDto): Promise<EvidenceResponseDto[]> {
    const evidence = await prisma.audit_Evidence.findMany({
      where: {
        engagement_id: engagementId,
        ...(query.workingPaperId && { working_paper_id: query.workingPaperId }),
        ...(query.findingId && { finding_id: query.findingId }),
      },
      orderBy: { uploaded_at: 'desc' },
    });
    return evidence.map(mapEvidenceToResponse);
  }

  private async _assertEngagementInProgress(engagementId: string): Promise<void> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { status: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    if (engagement.status !== EngagementStatus.InProgress) throw AppError.badRequest('Engagement must be in progress');
  }

  private async _assertWorkingPaperInEngagement(workingPaperId: string, engagementId: string): Promise<void> {
    const paper = await prisma.audit_Working_Paper.findFirst({
      where: { id: workingPaperId, engagement_id: engagementId, deleted_at: null },
      select: { id: true },
    });
    if (!paper) throw AppError.badRequest('Working paper does not belong to this engagement');
  }

  private async _assertFindingInEngagement(findingId: string, engagementId: string): Promise<void> {
    const finding = await prisma.audit_Finding.findFirst({
      where: { id: findingId, engagement_id: engagementId, deleted_at: null },
      select: { id: true },
    });
    if (!finding) throw AppError.badRequest('Finding does not belong to this engagement');
  }

  private async _getEvidence(evidenceId: string) {
    const evidence = await prisma.audit_Evidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw AppError.notFound('Audit evidence');
    return evidence;
  }
}
