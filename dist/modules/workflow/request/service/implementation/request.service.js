"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowRequestService = exports.RequestService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const document_service_1 = require("../../../../document/service/implementation/document.service");
const workflow_utility_1 = require("../../../utility/workflow.utility");
const request_enum_1 = require("../../domain/enum/request.enum");
const request_response_dto_1 = require("../../dto/response/request.response.dto");
const signature_utility_1 = require("../../utility/signature.utility");
const RECEIVE_PERMISSION = 'request:receive';
const ADMIN_PERMISSION = 'request:admin';
const ATTACHMENT_ENTITY_TYPE = 'workflow_request';
const workflowUserSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
    department: true,
    job_title: true,
});
const requestInclude = client_1.Prisma.validator()({
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
class RequestService {
    documentService;
    constructor(documentService = new document_service_1.DocumentService()) {
        this.documentService = documentService;
    }
    async createRequest(dto, actor) {
        (0, workflow_utility_1.assertHasPermission)(actor.permissions, 'request:create');
        const recipientIds = dto.recipientIds;
        if (new Set(recipientIds).size !== recipientIds.length) {
            throw app_error_1.AppError.badRequest('A recipient cannot appear more than once in the chain');
        }
        if (recipientIds.includes(actor.id)) {
            throw app_error_1.AppError.badRequest('You cannot add yourself as a recipient');
        }
        await this._assertRecipientsEligible(recipientIds);
        const referenceNumber = await this._nextReferenceNumber(new Date().getUTCFullYear());
        const created = await prisma_client_1.prisma.$transaction(async (tx) => {
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
        logger_util_1.logger.info('Workflow request created', { requestId: created.id, actorId: actor.id, recipients: recipientIds.length });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.request.create',
            module: 'workflow',
            entityType: ATTACHMENT_ENTITY_TYPE,
            entityId: created.id,
            newValues: { referenceNumber, recipientIds },
        });
        return this._toDetail(created);
    }
    async addAttachment(requestId, file, actor) {
        const request = await this._loadRequest(requestId);
        if (request.initiator_id !== actor.id) {
            throw app_error_1.AppError.forbidden('Only the initiator can attach files to this request');
        }
        if (request.status !== request_enum_1.RequestStatus.Pending || request.locked_at) {
            throw app_error_1.AppError.badRequest('Attachments can only be added before the first recipient acts');
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
        logger_util_1.logger.info('Workflow request attachment added', { requestId, documentId: document.id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
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
    async approve(requestId, actor, dto) {
        (0, workflow_utility_1.assertHasPermission)(actor.permissions, 'request:act');
        return this._advance(requestId, actor, request_enum_1.RequestActionType.Approve, {
            stepStatus: request_enum_1.RequestStepStatus.Approved,
            comment: dto.comment,
        });
    }
    async sign(requestId, actor, dto) {
        (0, workflow_utility_1.assertHasPermission)(actor.permissions, 'request:act');
        const request = await this._loadActionableRequest(requestId);
        this._assertCurrentRecipient(request, actor.id);
        await this._assertAffirmation(actor.id, dto.affirmation);
        const { hash, manifest } = await this._buildSignature(request, actor.id);
        return this._advance(requestId, actor, request_enum_1.RequestActionType.Sign, {
            stepStatus: request_enum_1.RequestStepStatus.Signed,
            comment: dto.comment,
            signatureHash: hash,
            signatureManifest: manifest,
            preloaded: request,
        });
    }
    async reject(requestId, actor, dto) {
        (0, workflow_utility_1.assertHasPermission)(actor.permissions, 'request:act');
        const request = await this._loadActionableRequest(requestId);
        const step = this._assertCurrentRecipient(request, actor.id);
        const now = new Date();
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.workflow_Request_Step.update({
                where: { id: step.id },
                data: { status: request_enum_1.RequestStepStatus.Rejected, acted_at: now },
            });
            await tx.workflow_Request.update({
                where: { id: requestId },
                data: { status: request_enum_1.RequestStatus.Rejected, locked_at: request.locked_at ?? now },
            });
            await tx.workflow_Request_Action.create({
                data: {
                    request_id: requestId,
                    step_id: step.id,
                    actor_id: actor.id,
                    action_type: request_enum_1.RequestActionType.Reject,
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
        logger_util_1.logger.info('Workflow request rejected', { requestId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.request.reject',
            module: 'workflow',
            entityType: ATTACHMENT_ENTITY_TYPE,
            entityId: requestId,
            newValues: { reason: dto.reason },
        });
        return this._toDetail(updated);
    }
    async comment(requestId, actor, dto) {
        (0, workflow_utility_1.assertHasPermission)(actor.permissions, 'request:act');
        const request = await this._loadActionableRequest(requestId);
        const isParticipant = request.initiator_id === actor.id || request.steps.some((s) => s.recipient_id === actor.id);
        if (!isParticipant && !actor.permissions.includes(ADMIN_PERMISSION)) {
            throw app_error_1.AppError.forbidden('Only the initiator or a recipient can comment on this request');
        }
        await prisma_client_1.prisma.workflow_Request_Action.create({
            data: {
                request_id: requestId,
                actor_id: actor.id,
                action_type: request_enum_1.RequestActionType.Comment,
                comment: dto.comment,
            },
        });
        const updated = await this._loadRequest(requestId);
        const currentStep = updated.steps.find((s) => s.level === updated.current_level);
        const recipients = new Set([updated.initiator_id]);
        if (currentStep)
            recipients.add(currentStep.recipient_id);
        recipients.delete(actor.id);
        const actorName = this._actorName(updated.actions.find((a) => a.actor_id === actor.id)?.actor ?? null);
        recipients.forEach((userId) => this._queueNotification(userId, updated, {
            title: 'New comment on a request',
            body: `${actorName} commented on "${updated.title}".`,
            type: 'info',
            eventKey: 'workflow.request.commented',
            variables: { requestTitle: updated.title, requestReference: updated.reference_number, actorName },
        }));
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.request.comment',
            module: 'workflow',
            entityType: ATTACHMENT_ENTITY_TYPE,
            entityId: requestId,
        });
        return this._toDetail(updated);
    }
    async cancel(requestId, actor) {
        const request = await this._loadRequest(requestId);
        if (request.status !== request_enum_1.RequestStatus.Pending) {
            throw app_error_1.AppError.badRequest('Only pending requests can be cancelled');
        }
        if (request.initiator_id !== actor.id && !actor.permissions.includes(ADMIN_PERMISSION)) {
            throw app_error_1.AppError.forbidden('Only the initiator or an admin can cancel this request');
        }
        const updated = await prisma_client_1.prisma.workflow_Request.update({
            where: { id: requestId },
            data: { status: request_enum_1.RequestStatus.Cancelled },
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
        logger_util_1.logger.info('Workflow request cancelled', { requestId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.request.cancel',
            module: 'workflow',
            entityType: ATTACHMENT_ENTITY_TYPE,
            entityId: requestId,
        });
        return this._toDetail(updated);
    }
    async getById(requestId, actor) {
        const request = await this._loadRequest(requestId);
        this._assertCanView(request, actor);
        return this._toDetail(request);
    }
    async list(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const involvement = [];
        if (query.role === 'initiated') {
            involvement.push({ initiator_id: actor.id });
        }
        else if (query.role === 'received') {
            involvement.push({ steps: { some: { recipient_id: actor.id } } });
        }
        else {
            involvement.push({ initiator_id: actor.id });
            involvement.push({ steps: { some: { recipient_id: actor.id } } });
        }
        const where = {
            deleted_at: null,
            ...(query.status && { status: query.status }),
            OR: involvement,
        };
        const [total, requests] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.workflow_Request.count({ where }),
            prisma_client_1.prisma.workflow_Request.findMany({
                where,
                include: requestInclude,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        const mapped = await Promise.all(requests.map((r) => this._toDetail(r)));
        return { requests: mapped, meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize) };
    }
    async inbox(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const steps = await prisma_client_1.prisma.workflow_Request_Step.findMany({
            where: {
                recipient_id: actor.id,
                status: request_enum_1.RequestStepStatus.Pending,
                request: { status: request_enum_1.RequestStatus.Pending, deleted_at: null },
            },
            include: { request: { include: requestInclude } },
            orderBy: { created_at: 'asc' },
        });
        const requests = steps
            .filter((step) => step.level === step.request.current_level)
            .map((step) => step.request);
        const paged = requests.slice(skip, skip + take);
        const mapped = await Promise.all(paged.map((r) => this._toDetail(r)));
        return { requests: mapped, meta: (0, api_response_type_1.buildPaginationMeta)(requests.length, page, pageSize) };
    }
    async getCandidates(actor) {
        const users = await prisma_client_1.prisma.user.findMany({
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
    async verifySignatures(requestId, actor) {
        const request = await this._loadRequest(requestId);
        this._assertCanView(request, actor);
        const signActions = request.actions.filter((a) => a.action_type === request_enum_1.RequestActionType.Sign && a.signature_hash && a.signature_manifest);
        if (signActions.length === 0)
            return [];
        const attachments = await this._buildAttachmentManifest(requestId);
        return Promise.all(signActions.map(async (action) => {
            const stored = JSON.parse(action.signature_manifest);
            const recomputed = (0, signature_utility_1.hashManifest)({
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
                storedHash: action.signature_hash,
                recomputedHash: recomputed,
            };
        }));
    }
    // ──────────────────────────────────────────────────────────
    // Internals
    // ──────────────────────────────────────────────────────────
    async _advance(requestId, actor, actionType, opts) {
        const request = opts.preloaded ?? (await this._loadActionableRequest(requestId));
        const step = this._assertCurrentRecipient(request, actor.id);
        const nextStep = request.steps.find((s) => s.level === request.current_level + 1);
        const now = new Date();
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
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
                        : { status: request_enum_1.RequestStatus.Completed }),
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
        }
        else {
            void this._notifyRequestEvent(updated, updated.initiator_id, {
                title: 'Request completed',
                body: `Your request "${updated.title}" has completed all steps.`,
                type: 'success',
                eventKey: 'workflow.request.completed',
                extraVariables: { requestTitle: updated.title, requestReference: updated.reference_number },
            });
        }
        logger_util_1.logger.info('Workflow request step actioned', { requestId, actionType, actorId: actor.id, completed: !nextStep });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: `workflow.request.${actionType}`,
            module: 'workflow',
            entityType: ATTACHMENT_ENTITY_TYPE,
            entityId: requestId,
            newValues: { signatureHash: opts.signatureHash },
        });
        return this._toDetail(updated);
    }
    async _buildSignature(request, signerId) {
        const attachments = await this._buildAttachmentManifest(request.id);
        const manifest = {
            requestId: request.id,
            title: request.title,
            description: request.description,
            attachments,
            signerId,
            signedAt: new Date().toISOString(),
        };
        return { hash: (0, signature_utility_1.hashManifest)(manifest), manifest: JSON.stringify(manifest) };
    }
    async _buildAttachmentManifest(requestId) {
        const documents = await this.documentService.listByEntity(ATTACHMENT_ENTITY_TYPE, requestId);
        return Promise.all(documents.map(async (doc) => {
            const file = await this.documentService.getFileById(doc.id);
            return {
                documentId: doc.id,
                originalName: doc.originalName,
                fileSize: doc.fileSize,
                sha256: (0, signature_utility_1.hashBuffer)(file.buffer),
            };
        }));
    }
    async _toDetail(request) {
        const documents = await this.documentService.listByEntity(ATTACHMENT_ENTITY_TYPE, request.id);
        const attachments = documents.map((doc) => ({
            documentId: doc.id,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            downloadUrl: doc.downloadUrl ?? '',
        }));
        return (0, request_response_dto_1.mapRequestToResponse)(request, attachments);
    }
    async _loadRequest(requestId) {
        const request = await prisma_client_1.prisma.workflow_Request.findFirst({
            where: { id: requestId, deleted_at: null },
            include: requestInclude,
        });
        if (!request)
            throw app_error_1.AppError.notFound('Workflow request');
        return request;
    }
    async _loadActionableRequest(requestId) {
        const request = await this._loadRequest(requestId);
        if (request.status !== request_enum_1.RequestStatus.Pending) {
            throw app_error_1.AppError.badRequest('Only pending requests can be acted on');
        }
        return request;
    }
    _assertCurrentRecipient(request, actorId) {
        const step = request.steps.find((s) => s.level === request.current_level);
        if (!step)
            throw app_error_1.AppError.badRequest('Request has no current step');
        if (step.recipient_id !== actorId) {
            throw app_error_1.AppError.forbidden('You are not the recipient for the current step');
        }
        if (step.status !== request_enum_1.RequestStepStatus.Pending) {
            throw app_error_1.AppError.badRequest('The current step has already been actioned');
        }
        return step;
    }
    _assertCanView(request, actor) {
        const isParticipant = request.initiator_id === actor.id || request.steps.some((s) => s.recipient_id === actor.id);
        if (!isParticipant && !actor.permissions.includes(ADMIN_PERMISSION)) {
            throw app_error_1.AppError.forbidden('You do not have access to this request');
        }
    }
    async _assertAffirmation(actorId, affirmation) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id: actorId },
            select: { display_name: true, first_name: true, last_name: true },
        });
        if (!user)
            throw app_error_1.AppError.notFound('User');
        const expected = (user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim()).toLowerCase();
        if (affirmation.trim().toLowerCase() !== expected) {
            throw app_error_1.AppError.badRequest('Affirmation must match your full name to sign');
        }
    }
    _eligibleRecipientWhere() {
        return {
            deleted_at: null,
            is_active: true,
            user_roles: {
                some: { role: { role_permissions: { some: { permission: { slug: RECEIVE_PERMISSION } } } } },
            },
        };
    }
    async _assertRecipientsEligible(recipientIds) {
        const eligible = await prisma_client_1.prisma.user.findMany({
            where: { ...this._eligibleRecipientWhere(), id: { in: recipientIds } },
            select: { id: true },
        });
        const eligibleIds = new Set(eligible.map((u) => u.id));
        const invalid = recipientIds.filter((id) => !eligibleIds.has(id));
        if (invalid.length > 0) {
            throw app_error_1.AppError.badRequest('One or more recipients are not eligible to receive requests');
        }
    }
    async _nextReferenceNumber(year) {
        const prefix = `REQ-${year}-`;
        const latest = await prisma_client_1.prisma.workflow_Request.findFirst({
            where: { reference_number: { startsWith: prefix } },
            orderBy: { reference_number: 'desc' },
            select: { reference_number: true },
        });
        const sequence = latest ? Number(latest.reference_number.slice(prefix.length)) + 1 : 1;
        return `${prefix}${String(Number.isFinite(sequence) ? sequence : 1).padStart(4, '0')}`;
    }
    _actorName(user) {
        if (!user)
            return '';
        return user.display_name?.trim() || `${user.first_name} ${user.last_name}`.trim();
    }
    async _notifyRequestEvent(request, recipientId, notification) {
        this._queueNotification(recipientId, request, {
            title: notification.title,
            body: notification.body,
            type: notification.type,
            eventKey: notification.eventKey,
            variables: notification.extraVariables ?? {},
        });
    }
    _queueNotification(userId, request, notification) {
        void this._notifyUser(userId, request, notification).catch((err) => {
            logger_util_1.logger.warn('Workflow request notification failed', { err, userId });
        });
    }
    async _notifyUser(userId, request, notification) {
        const user = await prisma_client_1.prisma.user.findFirst({
            where: { id: userId, deleted_at: null, is_active: true },
            select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
        });
        if (!user)
            return;
        const recipientName = this._actorName(user);
        const variables = { recipientName, ...notification.variables };
        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
            userId: user.id,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            referenceType: ATTACHMENT_ENTITY_TYPE,
            referenceId: request.id,
            eventKey: notification.eventKey,
            variables,
        });
        await notification_queue_service_1.notificationQueueService.enqueue('email', {
            to: user.email,
            subject: notification.title,
            text: notification.body,
            eventKey: notification.eventKey,
            variables,
        });
    }
}
exports.RequestService = RequestService;
exports.workflowRequestService = new RequestService();
//# sourceMappingURL=request.service.js.map