import { INotificationQueueService, NotificationQueuePayloadByType, NotificationQueueType } from '../interface/notification-queue.service.interface';
import { NotificationQueueStatsResponseDto } from '../../dto/response/notification-queue.response.dto';
export declare class NotificationQueueService implements INotificationQueueService {
    enqueue<T extends NotificationQueueType>(type: T, payload: NotificationQueuePayloadByType[T]): Promise<void>;
    processQueue(): Promise<void>;
    getQueueStats(): Promise<NotificationQueueStatsResponseDto>;
}
export declare const notificationQueueService: NotificationQueueService;
//# sourceMappingURL=notification-queue.service.d.ts.map