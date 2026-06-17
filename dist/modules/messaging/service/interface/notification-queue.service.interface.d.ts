import { Prisma } from '@prisma/client';
import { CreateInAppNotificationDto, SendEmailDto } from './notification.service.interface';
import { NotificationQueueStatsResponseDto } from '../../dto/response/notification-queue.response.dto';
export type NotificationQueueType = 'email' | 'in_app';
export type NotificationQueuePayloadByType = {
    email: SendEmailDto;
    in_app: CreateInAppNotificationDto;
};
/**
 * Semantic priority levels. Higher numbers are drained first by the queue
 * processor. Use HIGH for latency-sensitive transactional mail (OTP, password
 * reset) and NORMAL for everything else (reminders, workflow notifications).
 */
export declare const NOTIFICATION_PRIORITY: {
    readonly HIGH: 100;
    readonly NORMAL: 0;
};
export interface EnqueueOptions {
    /** Higher = sent sooner. Defaults to NOTIFICATION_PRIORITY.NORMAL. */
    priority?: number;
    /** Earliest time the item may be sent. Defaults to now. */
    scheduledAt?: Date;
    /**
     * Prisma transaction client. Pass this from inside a `$transaction` to make
     * the enqueue part of the same atomic unit as the business mutation
     * (transactional outbox) — the notification and the change commit together
     * or not at all.
     */
    tx?: Prisma.TransactionClient;
}
export interface INotificationQueueService {
    enqueue<T extends NotificationQueueType>(type: T, payload: NotificationQueuePayloadByType[T], options?: EnqueueOptions): Promise<void>;
    /**
     * Like {@link enqueue} but never throws. Use for post-commit notifications
     * where a queue-write failure must not surface to (or roll back) an
     * operation that has already succeeded.
     */
    enqueueSafe<T extends NotificationQueueType>(type: T, payload: NotificationQueuePayloadByType[T], options?: EnqueueOptions): Promise<void>;
    processQueue(): Promise<void>;
    getQueueStats(): Promise<NotificationQueueStatsResponseDto>;
}
//# sourceMappingURL=notification-queue.service.interface.d.ts.map