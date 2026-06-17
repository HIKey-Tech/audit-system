import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../../shared/types/api-response.type';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { notificationQueueService } from '../../../../messaging/service/implementation/notification-queue.service';
import { DocumentService } from '../../../../document/service/implementation/document.service';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { DocumentResponseDto } from '../../../../document/dto/response/document.response.dto';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { assertHasPermission } from '../../../utility/workflow.utility';
import {
  RequestActionType,
  RequestStatus,
  RequestStepStatus,
} from '../../domain/enum/request.enum';
import {
  ApproveRequestDto,
  CommentRequestDto,
  CreateRequestDto,
  RejectRequestDto,
  RequestInboxQueryDto,
  RequestListQueryDto,
  SignRequestDto,
} from '../../dto/request/request.request.dto';
import {
  RequestAttachmentDto,
  RequestResponseDto,
  SignatureVerificationDto,
  mapRequestToResponse,
} from '../../dto/response/request.response.dto';
import {
  IRequestService,
  RequestAttachmentCandidate,
  UploadRequestAttachmentInput,
} from '../interface/request.service.interface';
import {
  SignatureManifest,
  hashBuffer,
  hashManifest,
} from '../../utility/signature.utility';

const RECEIVE_PERMISSION = 'request:receive';
const ADMIN_PERMISSION = 'request:admin';
const ATTACHMENT_ENTITY_TYPE = 'workflow_request';

const workflowUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  display_name: true,
  first_name: true,
  last_name: true,
  department: true,
  job_title: true,
});

const requestInclude = Prisma.validator<Prisma.Workflow_RequestInclude>()({
  initiator: { select: workflowUserSelect },
  steps: {
    include: { recipient: { select: workflowUserSelect } },
    orderBy: { level: 'asc' },
  },
  actions: {
    include: { actor: { select: workflowUserSelect } },
    orderBy: { created_at: 'asc' },
  },
});

type RequestWithDetails = Prisma.Workflow_RequestGetPayload<{ include: typeof requestInclude }>;

interface NotificationTarget {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
}

export class RequestService implements IRequestService {
  constructor(private readonly documentService: IDocumentService = new DocumentService()) {}

  async createRequest(dto: CreateRequestDto, actor: WorkflowActorContext): Promise<RequestResponseDto> {
    assertHasPermission(actor.permissions, 'request:create');

    const recipientIds = dto.recipientIds;
    if (new Set(recipientIds).size !== recipientIds.length) {
      throw AppError.badRequest('A recipient cannot appear more than once in the chain');
    }
    if (recipientIds.includes(actor.id)) {
      throw AppError.badRequest('You cannot add yourself as a recipient');
    }
    await this._assertRecipientsEligible(recipientIds);

    const referenceNumber = await this._nextReferenceNumber(new Date().getUTCFullYear());

    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.workflow_Request.create({
        data: {
          reference_number: referenceNumber,
          title: dto.title,
          description: dto.description ?? null,
          initiator_id: actor.id,
          current_level: 1,
        },
      });

      await tx.workflow_Request_Step.createMany({
        data: recipientIds.map((recipientId, index) => ({
          request_id: request.id,
          level: index + 1,
          recipient_id: recipientId,
        })),
      });

      return tx.workflow_Request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude,
      });
    });

    void this._notifyRequestEvent(created, recipientIds[0], {
      title: 'Request awaiting your action',
      body: `${this._actorName(created.initiator)} sent you a request: "${created.title}".`,
      type: 'info',
      eventKey: 'workflow.request.created',
      extraVariables: {
        requestTitle: created.title,
        requestReference: created.reference_number,
        initiatorName: this._actorName(created.initiator),
      },
    });

    logger.info('Workflow request created', { requestId: created.id, actorId: actor.id, recipients: recipientIds.length });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'workflow.request.create',
      module: 'workflow',
      entityType: ATTACHMENT_ENTITY_TYPE,
      entityId: created.id,
      newValues: { referenceNumber, recipientIds },
    });

    return this._toDetail(created);
  }

  async addAttachment(
    requestId: string,
    file: UploadRequestAttachmentInput,
    actor: WorkflowActorContext,
  ): Promise<RequestAttachmentDto> {
    const request = await this._loadRequest(requestId);
    if (request.initiator_id !== actor.id) {
      throw AppError.forbidden('Only the initiator can attach files to this request');
    }
    if (request.status !== RequestStatus.Pending || request.locked_at) {
      throw AppError.badRequest('Attachments can only be added before the first recipient acts');
    }

    const document = await this.documentService.upload({
      uploadedById: actor.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      buffer: file.buffer,
      module: 'workflow',
      entityType: ATTACHMENT_ENTITY_TYPE,
      entityId: requestId,
    });

    logger.info('Workflow request attachment added', { requestId, documentId: document.id, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'workflow.request.attachment.add',
      module: 'workflow',
      entityType: ATTACHMENT_ENTITY_TYPE,
      entityId: requestId,
      newValues: { documentId: document.id, originalName: document.originalName },
    });

    return {
      documentId: document.id,
      originalName: document.originalName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      downloadUrl: document.downloadUrl ?? '',
    };
  }

  async approve(requestId: string, actor: WorkflowActorContext, dto: ApproveRequestDto): Promise<RequestResponseDto> {
    assertHasPermission(actor.permissions, 'request:act');
    return this._advance(requestId, actor, RequestActionType.Approve, {
      stepStatus: RequestStepStatus.Approved,
      comment: dto.comment,
    });
  }

  async sign(requestId: string, actor: WorkflowActorContext, dto: SignRequestDto): Promise<RequestResponseDto> {
    assertHasPermission(actor.permissions, 'request:act');

    const request = await this._loadActionableRequest(requestId);
    this._assertCurrentRecipient(request, actor.id);
    await this._assertAffirmation(actor.id, dto.affirmation);

    const { hash, manifest } = await this._buildSignature(request, actor.id);

    return this._advance(requestId, actor, RequestActionType.Sign, {
      stepStatus: RequestStepStatus.Signed,
      comment: dto.comment,
      signatureHash: hash,
      signatureManifest: manifest,
      preloaded: request,
    });
  }

  async reject(requestId: string, actor: WorkflowActorContext, dto: RejectRequestDto): Promise<RequestResponseDto> {
    assertHasPermission(actor.permissions, 'request:act');

    const request = await this._loadActionableRequest(requestId);
    const step = this._assertCurrentRecipient(request, actor.id);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workflow_Request_Step.update({
        where: { id: step.id },
        data: { status: RequestStepStatus.Rejected, acted_at: now },
      });
      await tx.workflow_Request.update({
        where: { id: requestId },
        data: { status: RequestStatus.Rejected, locked_at: request.locked_at ?? now },
      });
      await tx.workflow_Request_Action.create({
        data: {
          request_id: requestId,
          step_id: step.id,
          actor_id: actor.id,
          action_type: RequestActionType.Reject,
          comment: dto.reason,
        },
      });
      return tx.workflow_Request.findUniqueOrThrow({ where: { id: requestId }, include: requestInclude });
    });

    void this._notifyRequestEvent(updated, updated.initiator_id, {
      title: 'Request rejected',
      body: `Your request "${updated.title}" was rejected by ${this._actorName(step.recipient)}.`,
      type: 'warning',
      eventKey: 'workflow.request.rejected',
      extraVariables: {
        requestTitle: updated.title,
        requestReference: updated.reference_number,
        actorName: this._actorName(step.recipient),
        rejectionReason: dto.reason,
      },
    });

    logger.info('Workflow request rejected', { requestId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'workflow.request.reject',
      module: 'workflow',
      entityType: ATTACHMENT_ENTITY_TYPE,
      entityId: requestId,
      newValues: { reason: dto.reason },
    });

    return this._toDetail(updated);
  }

  async comment(requestId: string, actor: WorkflowActorContext, dto: CommentRequestDto): Promise<RequestResponseDto> {
    assertHasPermission(actor.permissions, 'request:act');
    const request = await this._loadActionableRequest(requestId);

    const isParticipant =
      request.initiator_id === actor.id || request.steps.some((s) => s.recipient_id === actor.id);
    if (!isParticipant && !actor.permissions.includes(ADMIN_PERMISSION)) {
      throw AppError.forbidden('Only the initiator or a recipient can comment on this request');
    }

    await prisma.workflow_Request_Action.create({
      data: {
        request_id: requestId,
        actor_id: actor.id,
        action_type: RequestActionType.Comment,
        comment: dto.comment,
      },
    });

    const updated = await this._loadRequest(requestId);
    const currentStep = updated.steps.find((s) => s.level === updated.current_level);
    const recipients = new Set<string>([updated.initiator_id]);
    if (currentStep) recipients.add(currentStep.recipient_id);
    recipients.delete(actor.id);

    const actorName = this._actorName(updated.actions.find((a) => a.actor_id === actor.id)?.actor ?? null);
    recipients.forEach((userId) =>
      this._queueNotification(userId, updated, {
        title: 'New comment on a request',
        body: `${actorName} commented on "${updated.title}".`,
        type: 'info',
        eventKey: 'workflow.request.commented',
        variables: { requestTitle: updated.title, requestReference: updated.reference_number, actorName },
      }),
    );

    auditLogService.logAsync({
      userId: actor.id,
      action: 'workflow.request.comment',
      module: 'workflow',
      entityType: ATTACHMENT_ENTITY_TYPE,
      entityId: requestId,
    });

    return this._toDetail(updated);
  }

  async cancel(requestId: string, actor: WorkflowActorContext): Promise<RequestResponseDto> {
    const request = await this._loadRequest(requestId);
    if (request.status !== RequestStatus.Pending) {
      throw AppError.badRequest('Only pending requests can be cancelled');
    }
    if (request.initiator_id !== actor.id && !actor.permissions.includes(ADMIN_PERMISSION)) {
      throw AppError.forbidden('Only the initiator or an admin can cancel this request');
    }

    const updated = await prisma.workflow_Request.update({
      where: { id: requestId },
      data: { status: RequestStatus.Cancelled },
      include: requestInclude,
    });

    const currentStep = updated.steps.find((s) => s.level === updated.current_level);
    if (currentStep) {
      void this._notifyRequestEvent(updated, currentStep.recipient_id, {
        title: 'Request cancelled',
        body: `The request "${updated.title}" was cancelled.`,
        type: 'warning',
        eventKey: 'workflow.request.cancelled',
        extraVariables: { requestTitle: updated.title, requestReference: updated.reference_number },
      });
    }

    logger.info('Workflow request cancelled', { requestId, actorId: actor.id });
    auditLogService.logAsync({
      userId: actor.id,
      action: 'workflow.request.cancel',
      module: 'workflow',
      entityType: ATTACHMENT_ENTITY_TYPE,
      entityId: requestId,
    });

    return this._toDetail(updated);
  }

  async getById(requestId: string, actor: WorkflowActorContext): Promise<RequestResponseDto> {
    const request = await this._loadRequest(requestId);
    this._assertCanView(request, actor);
    return this._toDetail(request);
  }

  async list(
    query: RequestListQueryDto,
    actor: WorkflowActorContext,
  ): Promise<{ requests: RequestResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const involvement: Prisma.Workflow_RequestWhereInput[] = [];
    if (query.role === 'initiated') {
      involvement.push({ initiator_id: actor.id });
    } else if (query.role === 'received') {
      involvement.push({ steps: { some: { recipient_id: actor.id } } });
    } else {
      involvement.push({ initiator_id: actor.id });
      involvement.push({ steps: { some: { recipient_id: actor.id } } });
    }

    const where: Prisma.Workflow_RequestWhereInput = {
      deleted_at: null,
      ...(query.status && { status: query.status }),
      OR: involvement,
    };

    const [total, requests] = await prisma.$transaction([
      prisma.workflow_Request.count({ where }),
      prisma.workflow_Request.findMany({
        where,
        include: requestInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    const mapped = await this._toDetailMany(requests);
    return { requests: mapped, meta: buildPaginationMeta(total, page, pageSize) };
  }

  async inbox(
    query: RequestInboxQueryDto,
    actor: WorkflowActorContext,
  ): Promise<{ requests: RequestResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const steps = await prisma.workflow_Request_Step.findMany({
      where: {
        recipient_id: actor.id,
        status: RequestStepStatus.Pending,
        request: { status: RequestStatus.Pending, deleted_at: null },
      },
      include: { request: { include: requestInclude } },
      orderBy: { created_at: 'asc' },
    });

    const requests = steps
      .filter((step) => step.level === step.request.current_level)
      .map((step) => step.request);
    const paged = requests.slice(skip, skip + take);

    const mapped = await this._toDetailMany(paged);
    return { requests: mapped, meta: buildPaginationMeta(requests.length, page, pageSize) };
  }

  async getCandidates(actor: WorkflowActorContext): Promise<RequestAttachmentCandidate[]> {
    const users = await prisma.user.findMany({
      where: { ...this._eligibleRecipientWhere(), id: { not: actor.id } },
      select: { id: true, display_name: true, first_name: true, last_name: true, email: true, department: true, job_title: true },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      displayName: u.display_name || `${u.first_name} ${u.last_name}`.trim(),
      email: u.email,
      department: u.department,
      jobTitle: u.job_title,
    }));
  }

  async verifySignatures(requestId: string, actor: WorkflowActorContext): Promise<SignatureVerificationDto[]> {
    const request = await this._loadRequest(requestId);
    this._assertCanView(request, actor);

    const signActions = request.actions.filter(
      (a) => a.action_type === RequestActionType.Sign && a.signature_hash && a.signature_manifest,
    );
    if (signActions.length === 0) return [];

    const attachments = await this._buildAttachmentManifest(requestId);

    return Promise.all(
      signActions.map(async (action) => {
        const stored = JSON.parse(action.signature_manifest as string) as SignatureManifest;
        const recomputed = hashManifest({
          requestId: request.id,
          title: request.title,
          description: request.description,
          attachments,
          signerId: stored.signerId,
          signedAt: stored.signedAt,
        });
        return {
          actionId: action.id,
          signerId: action.actor_id,
          signedAt: action.created_at.toISOString(),
          valid: recomputed === action.signature_hash,
          storedHash: action.signature_hash as string,
          recomputedHash: recomputed,
        };
      }),
    );
  }

  // ──────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────

  private async _advance(
    requestId: string,
    actor: WorkflowActorContext,
    actionType: RequestActionType,
    opts: {
      stepStatus: RequestStepStatus;
      comment?: string;
      signatureHash?: string;
      signatureManifest?: string;
      preloaded?: RequestWithDetails;
    },
  ): Promise<RequestResponseDto> {
    const request = opts.preloaded ?? (await this._loadActionableRequest(requestId));
    const step = this._assertCurrentRecipient(request, actor.id);
    const nextStep = request.steps.find((s) => s.level === request.current_level + 1);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workflow_Request_Step.update({
        where: { id: step.id },
        data: { status: opts.stepStatus, acted_at: now },
      });

      await tx.workflow_Request_Action.create({
        data: {
          request_id: requestId,
          step_id: step.id,
          actor_id: actor.id,
          action_type: actionType,
          comment: opts.comment ?? null,
          signature_hash: opts.signatureHash ?? null,
          signature_manifest: opts.signatureManifest ?? null,
        },
      });

      await tx.workflow_Request.update({
        where: { id: requestId },
        data: {
          locked_at: request.locked_at ?? now,
          ...(nextStep
            ? { current_level: nextStep.level }
            : { status: RequestStatus.Completed }),
        },
      });

      return tx.workflow_Request.findUniqueOrThrow({ where: { id: requestId }, include: requestInclude });
    });

    if (nextStep) {
      void this._notifyRequestEvent(updated, nextStep.recipient_id, {
        title: 'Request awaiting your action',
        body: `A request "${updated.title}" now needs your action.`,
        type: 'info',
        eventKey: 'workflow.request.created',
        extraVariables: {
          requestTitle: updated.title,
          requestReference: updated.reference_number,
          initiatorName: this._actorName(updated.initiator),
        },
      });
    } else {
      void this._notifyRequestEvent(updated, updated.initiator_id, {
        title: 'Request completed',
        body: `Your request "${updated.title}" has completed all steps.`,
        type: 'success',
        eventKey: 'workflow.request.completed',
        extraVariables: { requestTitle: updated.title, requestReference: updated.reference_number },
      });
    }

    logger.info('Workflow request step actioned', { requestId, actionType, actorId: actor.id, completed: !nextStep });
    auditLogService.logAsync({
      userId: actor.id,
      action: `workflow.request.${actionType}`,
      module: 'workflow',
      entityType: ATTACHMENT_ENTITY_TYPE,
      entityId: requestId,
      newValues: { signatureHash: opts.signatureHash },
    });

    return this._toDetail(updated);
  }

  private async _buildSignature(
    request: RequestWithDetails,
    signerId: string,
  ): Promise<{ hash: string; manifest: string }> {
    const attachments = await this._buildAttachmentManifest(request.id);
    const manifest: SignatureManifest = {
      requestId: request.id,
      title: request.title,
      description: request.description,
      attachments,
      signerId,
      signedAt: new Date().toISOString(),
    };
    return { hash: hashManifest(manifest), manifest: JSON.stringify(manifest) };
  }

  private async _buildAttachmentManifest(requestId: string): Promise<SignatureManifest['attachments']> {
    const documents = await this.documentService.listByEntity(ATTACHMENT_ENTITY_TYPE, requestId);
    return Promise.all(
      documents.map(async (doc) => {
        const file = await this.documentService.getFileById(doc.id);
        return {
          documentId: doc.id,
          originalName: doc.originalName,
          fileSize: doc.fileSize,
          sha256: hashBuffer(file.buffer),
        };
      }),
    );
  }

  private _toAttachments(documents: DocumentResponseDto[]): RequestAttachmentDto[] {
    return documents.map((doc) => ({
      documentId: doc.id,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      downloadUrl: doc.downloadUrl ?? '',
    }));
  }

  private async _toDetail(request: RequestWithDetails): Promise<RequestResponseDto> {
    const documents = await this.documentService.listByEntity(ATTACHMENT_ENTITY_TYPE, request.id);
    return mapRequestToResponse(request, this._toAttachments(documents));
  }

  // Batched detail mapping for list endpoints: loads every request's attachments
  // in one query instead of one per request (avoids an N+1).
  private async _toDetailMany(requests: RequestWithDetails[]): Promise<RequestResponseDto[]> {
    if (requests.length === 0) return [];
    const attachmentsByRequest = await this.documentService.listByEntityIds(
      ATTACHMENT_ENTITY_TYPE,
      requests.map((request) => request.id),
    );
    return requests.map((request) =>
      mapRequestToResponse(request, this._toAttachments(attachmentsByRequest.get(request.id) ?? [])),
    );
  }

  private async _loadRequest(requestId: string): Promise<RequestWithDetails> {
    const request = await prisma.workflow_Request.findFirst({
      where: { id: requestId, deleted_at: null },
      include: requestInclude,
    });
    if (!request) throw AppError.notFound('Workflow request');
    return request;
  }

  private async _loadActionableRequest(requestId: string): Promise<RequestWithDetails> {
    const request = await this._loadRequest(requestId);
    if (request.status !== RequestStatus.Pending) {
      throw AppError.badRequest('Only pending requests can be acted on');
    }
    return request;
  }

  private _assertCurrentRecipient(request: RequestWithDetails, actorId: string): RequestWithDetails['steps'][number] {
    const step = request.steps.find((s) => s.level === request.current_level);
    if (!step) throw AppError.badRequest('Request has no current step');
    if (step.recipient_id !== actorId) {
      throw AppError.forbidden('You are not the recipient for the current step');
    }
    if (step.status !== RequestStepStatus.Pending) {
      throw AppError.badRequest('The current step has already been actioned');
    }
    return step;
  }

  private _assertCanView(request: RequestWithDetails, actor: WorkflowActorContext): void {
    const isParticipant =
      request.initiator_id === actor.id || request.steps.some((s) => s.recipient_id === actor.id);
    if (!isParticipant && !actor.permissions.includes(ADMIN_PERMISSION)) {
      throw AppError.forbidden('You do not have access to this request');
    }
  }

  private async _assertAffirmation(actorId: string, affirmation: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: actorId },
      select: { display_name: true, first_name: true, last_name: true },
    });
    if (!user) throw AppError.notFound('User');
    const expected = (user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim()).toLowerCase();
    if (affirmation.trim().toLowerCase() !== expected) {
      throw AppError.badRequest('Affirmation must match your full name to sign');
    }
  }

  private _eligibleRecipientWhere(): Prisma.UserWhereInput {
    return {
      deleted_at: null,
      is_active: true,
      user_roles: {
        some: { role: { role_permissions: { some: { permission: { slug: RECEIVE_PERMISSION } } } } },
      },
    };
  }

  private async _assertRecipientsEligible(recipientIds: string[]): Promise<void> {
    const eligible = await prisma.user.findMany({
      where: { ...this._eligibleRecipientWhere(), id: { in: recipientIds } },
      select: { id: true },
    });
    const eligibleIds = new Set(eligible.map((u) => u.id));
    const invalid = recipientIds.filter((id) => !eligibleIds.has(id));
    if (invalid.length > 0) {
      throw AppError.badRequest('One or more recipients are not eligible to receive requests');
    }
  }

  private async _nextReferenceNumber(year: number): Promise<string> {
    const prefix = `REQ-${year}-`;
    const latest = await prisma.workflow_Request.findFirst({
      where: { reference_number: { startsWith: prefix } },
      orderBy: { reference_number: 'desc' },
      select: { reference_number: true },
    });
    const sequence = latest ? Number(latest.reference_number.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(sequence) ? sequence : 1).padStart(4, '0')}`;
  }

  private _actorName(user: NotificationTarget | { display_name: string | null; first_name: string; last_name: string } | null): string {
    if (!user) return '';
    return user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim();
  }

  private async _notifyRequestEvent(
    request: RequestWithDetails,
    recipientId: string,
    notification: {
      title: string;
      body: string;
      type: 'info' | 'warning' | 'error' | 'success';
      eventKey: string;
      extraVariables?: Record<string, string>;
    },
  ): Promise<void> {
    this._queueNotification(recipientId, request, {
      title: notification.title,
      body: notification.body,
      type: notification.type,
      eventKey: notification.eventKey,
      variables: notification.extraVariables ?? {},
    });
  }

  private _queueNotification(
    userId: string,
    request: RequestWithDetails,
    notification: {
      title: string;
      body: string;
      type: 'info' | 'warning' | 'error' | 'success';
      eventKey: string;
      variables: Record<string, string>;
    },
  ): void {
    void this._notifyUser(userId, request, notification).catch((err: unknown) => {
      logger.warn('Workflow request notification failed', { err, userId });
    });
  }

  private async _notifyUser(
    userId: string,
    request: RequestWithDetails,
    notification: {
      title: string;
      body: string;
      type: 'info' | 'warning' | 'error' | 'success';
      eventKey: string;
      variables: Record<string, string>;
    },
  ): Promise<void> {
    const user: NotificationTarget | null = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null, is_active: true },
      select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
    });
    if (!user) return;

    const recipientName = this._actorName(user);
    const variables = { recipientName, ...notification.variables };

    await notificationQueueService.enqueue('in_app', {
      userId: user.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      referenceType: ATTACHMENT_ENTITY_TYPE,
      referenceId: request.id,
      eventKey: notification.eventKey,
      variables,
    });

    await notificationQueueService.enqueue('email', {
      to: user.email,
      subject: notification.title,
      text: notification.body,
      eventKey: notification.eventKey,
      variables,
    });
  }
}

export const workflowRequestService = new RequestService();
