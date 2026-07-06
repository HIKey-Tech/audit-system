"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceRequestService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const evidence_request_response_dto_1 = require("../../dto/response/evidence-request.response.dto");
const OPEN = 'open';
const SUBMITTED = 'submitted';
const FULFILLED = 'fulfilled';
class EvidenceRequestService {
    documentService;
    constructor(documentService) {
        this.documentService = documentService;
    }
    async createRequest(engagementId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:request');
        const engagement = await this._getOpenEngagement(engagementId);
        const assignedToId = dto.assignedToId ?? engagement.auditee_id;
        const assignee = await prisma_client_1.prisma.user.findFirst({
            where: { id: assignedToId, deleted_at: null, is_active: true },
            select: { id: true, email: true },
        });
        if (!assignee)
            throw app_error_1.AppError.badRequest('Assigned user does not exist or is inactive');
        const request = await prisma_client_1.prisma.audit_Evidence_Request.create({
            data: {
                engagement_id: engagementId,
                title: dto.title,
                description: dto.description,
                due_date: dto.dueDate,
                requested_by_id: actor.id,
                assigned_to_id: assignedToId,
            },
            include: evidence_request_response_dto_1.evidenceRequestInclude,
        });
        logger_util_1.logger.info('Evidence request created', { requestId: request.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.create', module: 'audit', entityType: 'audit_evidence_request', entityId: request.id });
        const due = dto.dueDate ? ` Due ${dto.dueDate.toISOString().slice(0, 10)}.` : '';
        await this._notify(assignee.id, assignee.email, 'Evidence requested from you', `"${dto.title}" has been requested for audit ${engagement.reference_number} — ${engagement.title}.${due} Please log in to IAMS to upload the requested documents.`, engagementId);
        return (0, evidence_request_response_dto_1.mapEvidenceRequestToResponse)(request);
    }
    async listForEngagement(engagementId, actor) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { id: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        // Audit staff see every request; everyone else (auditee contacts) sees
        // only requests assigned to them.
        const isAuditStaff = actor.permissions.includes('evidence:request');
        const requests = await prisma_client_1.prisma.audit_Evidence_Request.findMany({
            where: {
                engagement_id: engagementId,
                deleted_at: null,
                ...(isAuditStaff ? {} : { assigned_to_id: actor.id }),
            },
            include: evidence_request_response_dto_1.evidenceRequestInclude,
            orderBy: { created_at: 'desc' },
        });
        return requests.map(evidence_request_response_dto_1.mapEvidenceRequestToResponse);
    }
    async listMine(actor) {
        const requests = await prisma_client_1.prisma.audit_Evidence_Request.findMany({
            where: { assigned_to_id: actor.id, deleted_at: null, status: { not: FULFILLED } },
            include: evidence_request_response_dto_1.evidenceRequestInclude,
            orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
        });
        return requests.map(evidence_request_response_dto_1.mapEvidenceRequestToResponse);
    }
    async respond(requestId, file, actor) {
        const request = await this._getRequest(requestId);
        if (request.status === FULFILLED)
            throw app_error_1.AppError.badRequest('This request has already been fulfilled');
        if (request.assigned_to_id !== actor.id && !actor.permissions.includes('evidence:request')) {
            throw app_error_1.AppError.forbidden('Only the assigned user can respond to this request');
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
        const [, updated] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Evidence.create({
                data: {
                    engagement_id: request.engagement_id,
                    request_id: requestId,
                    document_id: document.id,
                    file_name: file.originalName,
                    file_type: file.mimeType,
                    uploaded_by_id: actor.id,
                },
            }),
            prisma_client_1.prisma.audit_Evidence_Request.update({
                where: { id: requestId },
                data: { status: SUBMITTED, return_reason: null },
                include: evidence_request_response_dto_1.evidenceRequestInclude,
            }),
        ]);
        logger_util_1.logger.info('Evidence request responded', { requestId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.respond', module: 'audit', entityType: 'audit_evidence_request', entityId: requestId });
        await this._notify(updated.requested_by_id, updated.requested_by.email, 'Evidence submitted', `${updated.assigned_to.display_name ?? 'The auditee'} uploaded "${file.originalName}" for your request "${updated.title}" (${updated.engagement.reference_number}). Please review and accept or return it.`, updated.engagement_id);
        return (0, evidence_request_response_dto_1.mapEvidenceRequestToResponse)(updated);
    }
    async accept(requestId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:request');
        const request = await this._getRequest(requestId);
        if (request.status !== SUBMITTED)
            throw app_error_1.AppError.badRequest('Only submitted requests can be accepted');
        const updated = await prisma_client_1.prisma.audit_Evidence_Request.update({
            where: { id: requestId },
            data: { status: FULFILLED, fulfilled_at: new Date() },
            include: evidence_request_response_dto_1.evidenceRequestInclude,
        });
        logger_util_1.logger.info('Evidence request fulfilled', { requestId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.accept', module: 'audit', entityType: 'audit_evidence_request', entityId: requestId });
        await this._notify(updated.assigned_to_id, updated.assigned_to.email, 'Evidence accepted', `Your submission for "${updated.title}" (${updated.engagement.reference_number}) has been accepted. Nothing further is needed for this request.`, updated.engagement_id);
        return (0, evidence_request_response_dto_1.mapEvidenceRequestToResponse)(updated);
    }
    async returnRequest(requestId, reason, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:request');
        const request = await this._getRequest(requestId);
        if (request.status !== SUBMITTED)
            throw app_error_1.AppError.badRequest('Only submitted requests can be returned');
        const updated = await prisma_client_1.prisma.audit_Evidence_Request.update({
            where: { id: requestId },
            data: { status: OPEN, return_reason: reason },
            include: evidence_request_response_dto_1.evidenceRequestInclude,
        });
        logger_util_1.logger.info('Evidence request returned', { requestId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.return', module: 'audit', entityType: 'audit_evidence_request', entityId: requestId, newValues: { reason } });
        await this._notify(updated.assigned_to_id, updated.assigned_to.email, 'Evidence returned — action needed', `Your submission for "${updated.title}" (${updated.engagement.reference_number}) was returned: ${reason}. Please log in to IAMS and upload a corrected document.`, updated.engagement_id);
        return (0, evidence_request_response_dto_1.mapEvidenceRequestToResponse)(updated);
    }
    async cancelRequest(requestId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'evidence:request');
        const request = await this._getRequest(requestId);
        if (request.status === FULFILLED)
            throw app_error_1.AppError.badRequest('Fulfilled requests cannot be cancelled');
        await prisma_client_1.prisma.audit_Evidence_Request.update({ where: { id: requestId }, data: { deleted_at: new Date() } });
        logger_util_1.logger.info('Evidence request cancelled', { requestId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.evidence_request.cancel', module: 'audit', entityType: 'audit_evidence_request', entityId: requestId });
    }
    async _getRequest(requestId) {
        const request = await prisma_client_1.prisma.audit_Evidence_Request.findFirst({
            where: { id: requestId, deleted_at: null },
        });
        if (!request)
            throw app_error_1.AppError.notFound('Evidence request');
        return request;
    }
    async _getOpenEngagement(engagementId) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { id: true, status: true, auditee_id: true, reference_number: true, title: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (engagement.status === audit_enum_1.EngagementStatus.Closed)
            throw app_error_1.AppError.badRequest('Engagement is closed');
        return engagement;
    }
    /** in-app + email; queue-backed so a notification hiccup never fails the request. */
    async _notify(userId, email, title, body, engagementId) {
        await notification_queue_service_1.notificationQueueService.enqueueSafe('in_app', {
            userId,
            title,
            body,
            type: 'info',
            referenceType: 'audit_engagement',
            referenceId: engagementId,
        });
        if (email) {
            await notification_queue_service_1.notificationQueueService.enqueueSafe('email', {
                to: email,
                subject: `IAMS — ${title}`,
                text: `${body}\n\nRegards,\nIAMS — Internal Audit System`,
            });
        }
    }
}
exports.EvidenceRequestService = EvidenceRequestService;
//# sourceMappingURL=evidence-request.service.js.map