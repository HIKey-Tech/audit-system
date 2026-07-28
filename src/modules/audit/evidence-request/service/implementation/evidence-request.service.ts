import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EngagementStatus } from '../../../domain/enum/audit.enum';
import { assertHasPermission } from '../../../utility/audit.utility';
import { CreateEvidenceRequestDto } from '../../dto/request/evidence-request.request.dto';
import {
  AssignableUserDto,
  EvidenceRequestResponseDto,
  evidenceRequestInclude,
  mapEvidenceRequestToResponse,
} from '../../dto/response/evidence-request.response.dto';
import { IEvidenceRequestService, RespondFileDto } from '../interface/evidence-request.service.interface';

const OPEN = 'open';
const SUBMITTED = 'submitted';
const FULFILLED = 'fulfilled';

export class EvidenceRequestService implements IEvidenceRequestService {
  constructor(private readonly documentService: IDocumentService) {}

  async createRequest(
    engagementId: string,
    dto: CreateEvidenceRequestDto,
    actor: ActorContext,
  ): Promise<EvidenceRequestResponseDto> {
    assertHasPermission(actor.permissions, 'evidence:request');
    const engagement = await this._getOpenEngagement(engagementId);

    const assignedToId = dto.assignedToId ?? engagement.auditee_id;
    const assignee = await prisma.user.findFirst({
      where: { id: assignedToId, deleted_at: null, is_active: true },
      select: { id: true, email: true },
    });
    if (!assignee) throw AppError.badRequest('Assigned user does not exist or is inactive');

    const request = await prisma.audit_Evidence_Request.create({
      data: {
        engagement_id: engagementId,
        title: dto.title,
        description: dto.description,
        due_date: dto.dueDate,
        requested_by_id: actor.id,
        assigned_to_id: assignedToId,
      },
      include: evidenceRequestInclude,
    });

    logger.info('Evidence request created', { requestId: request.id, engagementId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.create', module: 'audit', entityType: 'audit_evidence_request', entityId: request.id });

    const due = dto.dueDate ? ` Due ${dto.dueDate.toISOString().slice(0, 10)}.` : '';
    await this._notify(
      assignee.id,
      assignee.email,
      'Evidence requested from you',
      `"${dto.title}" has been requested for audit ${engagement.reference_number} — ${engagement.title}.${due} Please log in to IAMS to upload the requested documents.`,
      engagementId,
    );

    return mapEvidenceRequestToResponse(request);
  }

  async listAssignableUsers(engagementId: string, actor: ActorContext): Promise<AssignableUserDto[]> {
    assertHasPermission(actor.permissions, 'evidence:request');
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, auditee_id: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    // ponytail: active users, capped at 200 for the picker. Evidence requests are
    // low-frequency; add a search param like the assignment-candidates endpoint if
    // GBB's directory ever outgrows a single dropdown.
    const users = await prisma.user.findMany({
      where: { deleted_at: null, is_active: true },
      select: {
        id: true,
        display_name: true,
        first_name: true,
        last_name: true,
        email: true,
        department: true,
        job_title: true,
      },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
      take: 200,
    });

    return users.map((u) => ({
      id: u.id,
      displayName: u.display_name || `${u.first_name} ${u.last_name}`.trim(),
      email: u.email,
      department: u.department,
      jobTitle: u.job_title,
      isAuditee: u.id === engagement.auditee_id,
    }));
  }

  async listForEngagement(engagementId: string, actor: ActorContext): Promise<EvidenceRequestResponseDto[]> {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');

    // Audit staff see every request; everyone else (auditee contacts) sees
    // only requests assigned to them.
    const isAuditStaff = actor.permissions.includes('evidence:request');
    const requests = await prisma.audit_Evidence_Request.findMany({
      where: {
        engagement_id: engagementId,
        deleted_at: null,
        ...(isAuditStaff ? {} : { assigned_to_id: actor.id }),
      },
      include: evidenceRequestInclude,
      orderBy: { created_at: 'desc' },
    });
    return requests.map(mapEvidenceRequestToResponse);
  }

  async listMine(actor: ActorContext): Promise<EvidenceRequestResponseDto[]> {
    const requests = await prisma.audit_Evidence_Request.findMany({
      where: { assigned_to_id: actor.id, deleted_at: null, status: { not: FULFILLED } },
      include: evidenceRequestInclude,
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
    });
    return requests.map(mapEvidenceRequestToResponse);
  }

  async respond(requestId: string, file: RespondFileDto, actor: ActorContext): Promise<EvidenceRequestResponseDto> {
    const request = await this._getRequest(requestId);
    if (request.status === FULFILLED) throw AppError.badRequest('This request has already been fulfilled');
    if (request.assigned_to_id !== actor.id && !actor.permissions.includes('evidence:request')) {
      throw AppError.forbidden('Only the assigned user can respond to this request');
    }
    await this._getOpenEngagement(request.engagement_id);

    const document = await this.documentService.upload({
      uploadedById: actor.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      buffer: file.buffer,
      module: 'audit',
      entityType: 'audit_engagement',
      entityId: request.engagement_id,
    });

    const [, updated] = await prisma.$transaction([
      prisma.audit_Evidence.create({
        data: {
          engagement_id: request.engagement_id,
          request_id: requestId,
          document_id: document.id,
          file_name: file.originalName,
          file_type: file.mimeType,
          uploaded_by_id: actor.id,
        },
      }),
      prisma.audit_Evidence_Request.update({
        where: { id: requestId },
        data: { status: SUBMITTED, return_reason: null },
        include: evidenceRequestInclude,
      }),
    ]);

    logger.info('Evidence request responded', { requestId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.respond', module: 'audit', entityType: 'audit_evidence_request', entityId: requestId });

    await this._notify(
      updated.requested_by_id,
      updated.requested_by.email,
      'Evidence submitted',
      `${updated.assigned_to.display_name ?? 'The auditee'} uploaded "${file.originalName}" for your request "${updated.title}" (${updated.engagement.reference_number}). Please review and accept or return it.`,
      updated.engagement_id,
    );

    return mapEvidenceRequestToResponse(updated);
  }

  async accept(requestId: string, actor: ActorContext): Promise<EvidenceRequestResponseDto> {
    assertHasPermission(actor.permissions, 'evidence:request');
    const request = await this._getRequest(requestId);
    if (request.status !== SUBMITTED) throw AppError.badRequest('Only submitted requests can be accepted');

    const updated = await prisma.audit_Evidence_Request.update({
      where: { id: requestId },
      data: { status: FULFILLED, fulfilled_at: new Date() },
      include: evidenceRequestInclude,
    });

    logger.info('Evidence request fulfilled', { requestId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.accept', module: 'audit', entityType: 'audit_evidence_request', entityId: requestId });

    await this._notify(
      updated.assigned_to_id,
      updated.assigned_to.email,
      'Evidence accepted',
      `Your submission for "${updated.title}" (${updated.engagement.reference_number}) has been accepted. Nothing further is needed for this request.`,
      updated.engagement_id,
    );

    return mapEvidenceRequestToResponse(updated);
  }

  async returnRequest(requestId: string, reason: string, actor: ActorContext): Promise<EvidenceRequestResponseDto> {
    assertHasPermission(actor.permissions, 'evidence:request');
    const request = await this._getRequest(requestId);
    if (request.status !== SUBMITTED) throw AppError.badRequest('Only submitted requests can be returned');

    const updated = await prisma.audit_Evidence_Request.update({
      where: { id: requestId },
      data: { status: OPEN, return_reason: reason },
      include: evidenceRequestInclude,
    });

    logger.info('Evidence request returned', { requestId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.return', module: 'audit', entityType: 'audit_evidence_request', entityId: requestId, newValues: { reason } });

    await this._notify(
      updated.assigned_to_id,
      updated.assigned_to.email,
      'Evidence returned — action needed',
      `Your submission for "${updated.title}" (${updated.engagement.reference_number}) was returned: ${reason}. Please log in to IAMS and upload a corrected document.`,
      updated.engagement_id,
    );

    return mapEvidenceRequestToResponse(updated);
  }

  async cancelRequest(requestId: string, actor: ActorContext): Promise<void> {
    assertHasPermission(actor.permissions, 'evidence:request');
    const request = await this._getRequest(requestId);
    if (request.status === FULFILLED) throw AppError.badRequest('Fulfilled requests cannot be cancelled');

    await prisma.audit_Evidence_Request.update({ where: { id: requestId }, data: { deleted_at: new Date() } });
    logger.info('Evidence request cancelled', { requestId, actorId: actor.id });
    auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.cancel', module: 'audit', entityType: 'audit_evidence_request', entityId: requestId });
  }

  private async _getRequest(requestId: string) {
    const request = await prisma.audit_Evidence_Request.findFirst({
      where: { id: requestId, deleted_at: null },
    });
    if (!request) throw AppError.notFound('Evidence request');
    return request;
  }

  private async _getOpenEngagement(engagementId: string) {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, status: true, auditee_id: true, reference_number: true, title: true },
    });
    if (!engagement) throw AppError.notFound('Audit engagement');
    if (engagement.status === EngagementStatus.Closed) throw AppError.badRequest('Engagement is closed');
    return engagement;
  }

  /** in-app + email; queue-backed so a notification hiccup never fails the request. */
  private async _notify(userId: string, email: string, title: string, body: string, engagementId: string): Promise<void> {
    await notificationQueueService.enqueueSafe('in_app', {
      userId,
      title,
      body,
      type: 'info',
      referenceType: 'audit_engagement',
      referenceId: engagementId,
    });
    if (email) {
      await notificationQueueService.enqueueSafe('email', {
        to: email,
        subject: `IAMS — ${title}`,
        text: `${body}\n\nRegards,\nIAMS — Internal Audit System`,
      });
    }
  }
}
