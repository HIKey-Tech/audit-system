import { EnqueueOptions, INotificationQueueService, NotificationQueuePayloadByType, NotificationQueueType } from '../interface/notification-queue.service.interface';
import { NotificationQueueStatsResponseDto } from '../../dto/response/notification-queue.response.dto';
export declare class NotificationQueueService implements INotificationQueueService {
    private isProcessing;
    enqueue<T extends NotificationQueueType>(type: T, payload: NotificationQueuePayloadByType[T], options?: EnqueueOptions): Promise<void>;
    enqueueSafe<T extends NotificationQueueType>(type: T, payload: NotificationQueuePayloadByType[T], options?: EnqueueOptions): Promise<void>;
    processQueue(): Promise<void>;
    private _drainQueue;
    getQueueStats(): Promise<NotificationQueueStatsResponseDto>;
}
export declare const notificationQueueService: NotificationQueueService;
//# sourceMappingURL=notification-queue.service.d.ts.map