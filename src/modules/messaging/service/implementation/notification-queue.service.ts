import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import {
  CreateInAppNotificationDto,
  SendEmailDto,
} from '../interface/notification.service.interface';
import {
  EnqueueOptions,
  INotificationQueueService,
  NOTIFICATION_PRIORITY,
  NotificationQueuePayloadByType,
  NotificationQueueType,
} from '../interface/notification-queue.service.interface';
import { notificationService } from './notification.service';
import { templateService } from './template.service';
import { renderTemplate } from '../../utility/template.utility';
import { NotificationQueueStatsResponseDto } from '../../dto/response/notification-queue.response.dto';

const BATCH_SIZE = 50;
const PENDING_STATUS = 'pending';
const PROCESSING_STATUS = 'processing';
const SENT_STATUS = 'sent';
const FAILED_STATUS = 'failed';

// Exponential backoff between retries: 2^attempts minutes, capped. Keeps a
// flapping SMTP relay or a single bad recipient from being hammered every tick.
const RETRY_BACKOFF_CAP_MINUTES = 60;
const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const computeRetryDelayMs = (attempts: number): number => {
  const minutes = Math.min(2 ** attempts, RETRY_BACKOFF_CAP_MINUTES);
  return minutes * 60 * 1000;
};

type QueueStatus = typeof PENDING_STATUS
  | typeof PROCESSING_STATUS
  | typeof SENT_STATUS
  | typeof FAILED_STATUS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

const optionalRecord = (value: unknown): value is Record<string, unknown> | undefined =>
  value === undefined || isRecord(value);

const optionalStringRecord = (value: unknown): value is Record<string, string> | undefined =>
  value === undefined || isStringRecord(value);

const isQueueStatus = (status: string): status is QueueStatus =>
  status === PENDING_STATUS
  || status === PROCESSING_STATUS
  || status === SENT_STATUS
  || status === FAILED_STATUS;

const parseEmailPayload = (payload: string): SendEmailDto => {
  const parsed: unknown = JSON.parse(payload);
  if (!isRecord(parsed)) {
    throw AppError.badRequest('Email notification payload must be an object');
  }

  const to = parsed.to;
  if (typeof to !== 'string' && !isStringArray(to)) {
    throw AppError.badRequest('Email notification payload requires to');
  }
  if (typeof parsed.subject !== 'string') {
    throw AppError.badRequest('Email notification payload requires subject');
  }
  if (!optionalString(parsed.template)) {
    throw AppError.badRequest('Email notification template must be a string');
  }
  if (!optionalString(parsed.html)) {
    throw AppError.badRequest('Email notification html must be a string');
  }
  if (!optionalString(parsed.text)) {
    throw AppError.badRequest('Email notification text must be a string');
  }
  if (!optionalRecord(parsed.data)) {
    throw AppError.badRequest('Email notification data must be an object');
  }
  if (!optionalString(parsed.eventKey)) {
    throw AppError.badRequest('Email notification eventKey must be a string');
  }
  if (!optionalStringRecord(parsed.variables)) {
    throw AppError.badRequest('Email notification variables must be a string-to-string map');
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

const parseInAppPayload = (payload: string): CreateInAppNotificationDto => {
  const parsed: unknown = JSON.parse(payload);
  if (!isRecord(parsed)) {
    throw AppError.badRequest('In-app notification payload must be an object');
  }
  if (typeof parsed.userId !== 'string') {
    throw AppError.badRequest('In-app notification payload requires userId');
  }
  if (typeof parsed.title !== 'string') {
    throw AppError.badRequest('In-app notification payload requires title');
  }
  if (typeof parsed.body !== 'string') {
    throw AppError.badRequest('In-app notification payload requires body');
  }
  if (
    parsed.type !== 'info'
    && parsed.type !== 'warning'
    && parsed.type !== 'error'
    && parsed.type !== 'success'
  ) {
    throw AppError.badRequest('In-app notification payload has invalid type');
  }
  if (!optionalString(parsed.referenceType)) {
    throw AppError.badRequest('In-app notification referenceType must be a string');
  }
  if (!optionalString(parsed.referenceId)) {
    throw AppError.badRequest('In-app notification referenceId must be a string');
  }
  if (!optionalRecord(parsed.metadata)) {
    throw AppError.badRequest('In-app notification metadata must be an object');
  }
  if (!optionalString(parsed.eventKey)) {
    throw AppError.badRequest('In-app notification eventKey must be a string');
  }
  if (!optionalStringRecord(parsed.variables)) {
    throw AppError.badRequest('In-app notification variables must be a string-to-string map');
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

const renderEmailWithTemplate = async (dto: SendEmailDto): Promise<SendEmailDto> => {
  if (!dto.eventKey) return dto;

  const template = await templateService.getTemplateByEventAndChannel(dto.eventKey, 'email');
  if (!template) return dto;

  const variables = dto.variables ?? {};
  const renderedBody = renderTemplate(template.body, variables);
  const renderedSubject = template.subject
    ? renderTemplate(template.subject, variables)
    : dto.subject;

  return {
    ...dto,
    subject: renderedSubject,
    html: renderedBody,
    text: renderedBody,
  };
};

const renderInAppWithTemplate = async (
  dto: CreateInAppNotificationDto,
): Promise<CreateInAppNotificationDto> => {
  if (!dto.eventKey) return dto;

  const template = await templateService.getTemplateByEventAndChannel(dto.eventKey, 'in_app');
  if (!template) return dto;

  const variables = dto.variables ?? {};
  return {
    ...dto,
    body: renderTemplate(template.body, variables),
  };
};

export class NotificationQueueService implements INotificationQueueService {
  // Single-process re-entrancy guard. Prevents an overlapping cron tick from
  // starting a second drain while one is still running (cross-instance
  // double-send is already prevented by the optimistic claim below).
  private isProcessing = false;

  async enqueue<T extends NotificationQueueType>(
    type: T,
    payload: NotificationQueuePayloadByType[T],
    options: EnqueueOptions = {},
  ): Promise<void> {
    const db = options.tx ?? prisma;
    await db.notification_Queue.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        status: PENDING_STATUS,
        priority: options.priority ?? NOTIFICATION_PRIORITY.NORMAL,
        ...(options.scheduledAt ? { scheduled_at: options.scheduledAt } : {}),
      },
    });

    logger.info('Notification queued', { type, priority: options.priority ?? NOTIFICATION_PRIORITY.NORMAL });
  }

  async enqueueSafe<T extends NotificationQueueType>(
    type: T,
    payload: NotificationQueuePayloadByType[T],
    options: EnqueueOptions = {},
  ): Promise<void> {
    try {
      await this.enqueue(type, payload, options);
    } catch (err) {
      logger.error('Notification enqueue failed (suppressed)', { err, type });
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Notification queue drain skipped — previous run still in progress');
      return;
    }
    this.isProcessing = true;
    try {
      await this._drainQueue();
    } finally {
      this.isProcessing = false;
    }
  }

  private async _drainQueue(): Promise<void> {
    await this._recoverStaleProcessingItems();

    const items = await prisma.notification_Queue.findMany({
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
          await prisma.notification_Queue.update({
            where: { id: item.id },
            data: {
              status: FAILED_STATUS,
              last_error: item.last_error ?? 'Maximum notification attempts reached',
              processed_at: new Date(),
            },
          });
          logger.error('Queued notification marked failed before processing', {
            queueId: item.id,
            type: item.type,
            attempts: item.attempts,
            maxAttempts: item.max_attempts,
          });
          continue;
        }

        const claimed = await prisma.notification_Queue.updateMany({
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
          await notificationService.sendEmail(emailDto);
        } else if (item.type === 'in_app') {
          const inAppDto = await renderInAppWithTemplate(parseInAppPayload(item.payload));
          await notificationService.sendInAppNotification(inAppDto);
        } else {
          throw AppError.badRequest(`Unsupported notification queue type: ${item.type}`);
        }

        await prisma.notification_Queue.update({
          where: { id: item.id },
          data: {
            status: SENT_STATUS,
            processed_at: new Date(),
          },
        });

        logger.info('Queued notification processed', {
          queueId: item.id,
          type: item.type,
        });
      } catch (err) {
        const attempts = item.attempts + 1;
        const finalFailure = attempts >= item.max_attempts;
        const status = finalFailure ? FAILED_STATUS : PENDING_STATUS;
        const lastError = err instanceof Error ? err.message : String(err);

        await prisma.notification_Queue.update({
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
        }).catch((updateErr: unknown) => {
          logger.error('Notification queue failure state update failed', {
            err: updateErr,
            originalError: err,
            queueId: item.id,
            type: item.type,
            attempts,
            maxAttempts: item.max_attempts,
          });
        });

        logger.error('Queued notification processing failed', {
          err,
          queueId: item.id,
          type: item.type,
          attempts,
          maxAttempts: item.max_attempts,
          finalFailure,
        });
      }
    }

    logger.info('Notification queue processing completed', { count: items.length });
  }

  private async _recoverStaleProcessingItems(): Promise<void> {
    const staleItems = await prisma.notification_Queue.findMany({
      where: {
        status: PROCESSING_STATUS,
        updated_at: { lt: new Date(Date.now() - PROCESSING_TIMEOUT_MS) },
      },
      take: BATCH_SIZE,
    });

    for (const item of staleItems) {
      const finalFailure = item.attempts >= item.max_attempts;
      await prisma.notification_Queue.updateMany({
        where: { id: item.id, status: PROCESSING_STATUS },
        data: {
          status: finalFailure ? FAILED_STATUS : PENDING_STATUS,
          last_error: finalFailure
            ? (item.last_error ?? 'Notification processing timed out')
            : 'Notification processing timed out; retry scheduled',
          processed_at: finalFailure ? new Date() : null,
          ...(finalFailure
            ? {}
            : { scheduled_at: new Date(Date.now() + computeRetryDelayMs(item.attempts)) }),
        },
      });
    }

    if (staleItems.length > 0) {
      logger.warn('Recovered stale notification queue items', { count: staleItems.length });
    }
  }

  async getQueueStats(): Promise<NotificationQueueStatsResponseDto> {
    const grouped = await prisma.notification_Queue.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const stats: NotificationQueueStatsResponseDto = {
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

export const notificationQueueService = new NotificationQueueService();
