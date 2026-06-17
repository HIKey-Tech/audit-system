"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQueueService = exports.NotificationQueueService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const notification_queue_service_interface_1 = require("../interface/notification-queue.service.interface");
const notification_service_1 = require("./notification.service");
const template_service_1 = require("./template.service");
const template_utility_1 = require("../../utility/template.utility");
const BATCH_SIZE = 50;
const PENDING_STATUS = 'pending';
const PROCESSING_STATUS = 'processing';
const SENT_STATUS = 'sent';
const FAILED_STATUS = 'failed';
// Exponential backoff between retries: 2^attempts minutes, capped. Keeps a
// flapping SMTP relay or a single bad recipient from being hammered every tick.
const RETRY_BACKOFF_CAP_MINUTES = 60;
const computeRetryDelayMs = (attempts) => {
    const minutes = Math.min(2 ** attempts, RETRY_BACKOFF_CAP_MINUTES);
    return minutes * 60 * 1000;
};
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isStringRecord = (value) => isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
const optionalString = (value) => value === undefined || typeof value === 'string';
const optionalRecord = (value) => value === undefined || isRecord(value);
const optionalStringRecord = (value) => value === undefined || isStringRecord(value);
const isQueueStatus = (status) => status === PENDING_STATUS
    || status === PROCESSING_STATUS
    || status === SENT_STATUS
    || status === FAILED_STATUS;
const parseEmailPayload = (payload) => {
    const parsed = JSON.parse(payload);
    if (!isRecord(parsed)) {
        throw app_error_1.AppError.badRequest('Email notification payload must be an object');
    }
    const to = parsed.to;
    if (typeof to !== 'string' && !isStringArray(to)) {
        throw app_error_1.AppError.badRequest('Email notification payload requires to');
    }
    if (typeof parsed.subject !== 'string') {
        throw app_error_1.AppError.badRequest('Email notification payload requires subject');
    }
    if (!optionalString(parsed.template)) {
        throw app_error_1.AppError.badRequest('Email notification template must be a string');
    }
    if (!optionalString(parsed.html)) {
        throw app_error_1.AppError.badRequest('Email notification html must be a string');
    }
    if (!optionalString(parsed.text)) {
        throw app_error_1.AppError.badRequest('Email notification text must be a string');
    }
    if (!optionalRecord(parsed.data)) {
        throw app_error_1.AppError.badRequest('Email notification data must be an object');
    }
    if (!optionalString(parsed.eventKey)) {
        throw app_error_1.AppError.badRequest('Email notification eventKey must be a string');
    }
    if (!optionalStringRecord(parsed.variables)) {
        throw app_error_1.AppError.badRequest('Email notification variables must be a string-to-string map');
    }
    return {
        to,
        subject: parsed.subject,
        template: parsed.template,
        html: parsed.html,
        text: parsed.text,
        data: parsed.data,
        eventKey: parsed.eventKey,
        variables: parsed.variables,
    };
};
const parseInAppPayload = (payload) => {
    const parsed = JSON.parse(payload);
    if (!isRecord(parsed)) {
        throw app_error_1.AppError.badRequest('In-app notification payload must be an object');
    }
    if (typeof parsed.userId !== 'string') {
        throw app_error_1.AppError.badRequest('In-app notification payload requires userId');
    }
    if (typeof parsed.title !== 'string') {
        throw app_error_1.AppError.badRequest('In-app notification payload requires title');
    }
    if (typeof parsed.body !== 'string') {
        throw app_error_1.AppError.badRequest('In-app notification payload requires body');
    }
    if (parsed.type !== 'info'
        && parsed.type !== 'warning'
        && parsed.type !== 'error'
        && parsed.type !== 'success') {
        throw app_error_1.AppError.badRequest('In-app notification payload has invalid type');
    }
    if (!optionalString(parsed.referenceType)) {
        throw app_error_1.AppError.badRequest('In-app notification referenceType must be a string');
    }
    if (!optionalString(parsed.referenceId)) {
        throw app_error_1.AppError.badRequest('In-app notification referenceId must be a string');
    }
    if (!optionalRecord(parsed.metadata)) {
        throw app_error_1.AppError.badRequest('In-app notification metadata must be an object');
    }
    if (!optionalString(parsed.eventKey)) {
        throw app_error_1.AppError.badRequest('In-app notification eventKey must be a string');
    }
    if (!optionalStringRecord(parsed.variables)) {
        throw app_error_1.AppError.badRequest('In-app notification variables must be a string-to-string map');
    }
    return {
        userId: parsed.userId,
        title: parsed.title,
        body: parsed.body,
        type: parsed.type,
        referenceType: parsed.referenceType,
        referenceId: parsed.referenceId,
        metadata: parsed.metadata,
        eventKey: parsed.eventKey,
        variables: parsed.variables,
    };
};
const renderEmailWithTemplate = async (dto) => {
    if (!dto.eventKey)
        return dto;
    const template = await template_service_1.templateService.getTemplateByEventAndChannel(dto.eventKey, 'email');
    if (!template)
        return dto;
    const variables = dto.variables ?? {};
    const renderedBody = (0, template_utility_1.renderTemplate)(template.body, variables);
    const renderedSubject = template.subject
        ? (0, template_utility_1.renderTemplate)(template.subject, variables)
        : dto.subject;
    return {
        ...dto,
        subject: renderedSubject,
        html: renderedBody,
        text: renderedBody,
    };
};
const renderInAppWithTemplate = async (dto) => {
    if (!dto.eventKey)
        return dto;
    const template = await template_service_1.templateService.getTemplateByEventAndChannel(dto.eventKey, 'in_app');
    if (!template)
        return dto;
    const variables = dto.variables ?? {};
    return {
        ...dto,
        body: (0, template_utility_1.renderTemplate)(template.body, variables),
    };
};
class NotificationQueueService {
    // Single-process re-entrancy guard. Prevents an overlapping cron tick from
    // starting a second drain while one is still running (cross-instance
    // double-send is already prevented by the optimistic claim below).
    isProcessing = false;
    async enqueue(type, payload, options = {}) {
        const db = options.tx ?? prisma_client_1.prisma;
        await db.notification_Queue.create({
            data: {
                type,
                payload: JSON.stringify(payload),
                status: PENDING_STATUS,
                priority: options.priority ?? notification_queue_service_interface_1.NOTIFICATION_PRIORITY.NORMAL,
                ...(options.scheduledAt ? { scheduled_at: options.scheduledAt } : {}),
            },
        });
        logger_util_1.logger.info('Notification queued', { type, priority: options.priority ?? notification_queue_service_interface_1.NOTIFICATION_PRIORITY.NORMAL });
    }
    async enqueueSafe(type, payload, options = {}) {
        try {
            await this.enqueue(type, payload, options);
        }
        catch (err) {
            logger_util_1.logger.error('Notification enqueue failed (suppressed)', { err, type });
        }
    }
    async processQueue() {
        if (this.isProcessing) {
            logger_util_1.logger.warn('Notification queue drain skipped — previous run still in progress');
            return;
        }
        this.isProcessing = true;
        try {
            await this._drainQueue();
        }
        finally {
            this.isProcessing = false;
        }
    }
    async _drainQueue() {
        const items = await prisma_client_1.prisma.notification_Queue.findMany({
            where: {
                status: PENDING_STATUS,
                scheduled_at: { lte: new Date() },
            },
            orderBy: [{ priority: 'desc' }, { scheduled_at: 'asc' }],
            take: BATCH_SIZE,
        });
        for (const item of items) {
            try {
                if (item.attempts >= item.max_attempts) {
                    await prisma_client_1.prisma.notification_Queue.update({
                        where: { id: item.id },
                        data: {
                            status: FAILED_STATUS,
                            last_error: item.last_error ?? 'Maximum notification attempts reached',
                            processed_at: new Date(),
                        },
                    });
                    logger_util_1.logger.error('Queued notification marked failed before processing', {
                        queueId: item.id,
                        type: item.type,
                        attempts: item.attempts,
                        maxAttempts: item.max_attempts,
                    });
                    continue;
                }
                const claimed = await prisma_client_1.prisma.notification_Queue.updateMany({
                    where: { id: item.id, status: PENDING_STATUS },
                    data: {
                        status: PROCESSING_STATUS,
                        attempts: { increment: 1 },
                        last_error: null,
                    },
                });
                if (claimed.count === 0) {
                    continue;
                }
                if (item.type === 'email') {
                    const emailDto = await renderEmailWithTemplate(parseEmailPayload(item.payload));
                    await notification_service_1.notificationService.sendEmail(emailDto);
                }
                else if (item.type === 'in_app') {
                    const inAppDto = await renderInAppWithTemplate(parseInAppPayload(item.payload));
                    await notification_service_1.notificationService.sendInAppNotification(inAppDto);
                }
                else {
                    throw app_error_1.AppError.badRequest(`Unsupported notification queue type: ${item.type}`);
                }
                await prisma_client_1.prisma.notification_Queue.update({
                    where: { id: item.id },
                    data: {
                        status: SENT_STATUS,
                        processed_at: new Date(),
                    },
                });
                logger_util_1.logger.info('Queued notification processed', {
                    queueId: item.id,
                    type: item.type,
                });
            }
            catch (err) {
                const attempts = item.attempts + 1;
                const finalFailure = attempts >= item.max_attempts;
                const status = finalFailure ? FAILED_STATUS : PENDING_STATUS;
                const lastError = err instanceof Error ? err.message : String(err);
                await prisma_client_1.prisma.notification_Queue.update({
                    where: { id: item.id },
                    data: {
                        status,
                        last_error: lastError,
                        processed_at: finalFailure ? new Date() : null,
                        // Defer the next retry with exponential backoff.
                        ...(finalFailure
                            ? {}
                            : { scheduled_at: new Date(Date.now() + computeRetryDelayMs(attempts)) }),
                    },
                }).catch((updateErr) => {
                    logger_util_1.logger.error('Notification queue failure state update failed', {
                        err: updateErr,
                        originalError: err,
                        queueId: item.id,
                        type: item.type,
                        attempts,
                        maxAttempts: item.max_attempts,
                    });
                });
                logger_util_1.logger.error('Queued notification processing failed', {
                    err,
                    queueId: item.id,
                    type: item.type,
                    attempts,
                    maxAttempts: item.max_attempts,
                    finalFailure,
                });
            }
        }
        logger_util_1.logger.info('Notification queue processing completed', { count: items.length });
    }
    async getQueueStats() {
        const grouped = await prisma_client_1.prisma.notification_Queue.groupBy({
            by: ['status'],
            _count: { _all: true },
        });
        const stats = {
            pending: 0,
            processing: 0,
            sent: 0,
            failed: 0,
            total: 0,
        };
        for (const item of grouped) {
            if (isQueueStatus(item.status)) {
                stats[item.status] = item._count._all;
                stats.total += item._count._all;
            }
        }
        return stats;
    }
}
exports.NotificationQueueService = NotificationQueueService;
exports.notificationQueueService = new NotificationQueueService();
//# sourceMappingURL=notification-queue.service.js.map