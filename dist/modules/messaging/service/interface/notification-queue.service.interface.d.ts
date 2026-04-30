import { CreateInAppNotificationDto, SendEmailDto } from './notification.service.interface';
import { NotificationQueueStatsResponseDto } from '../../dto/response/notification-queue.response.dto';
export type NotificationQueueType = 'email' | 'in_app';
export type NotificationQueuePayloadByType = {
    email: SendEmailDto;
    in_app: CreateInAppNotificationDto;
};
export interface INotificationQueueService {
    enqueue<T extends NotificationQueueType>(type: T, payload: NotificationQueuePayloadByType[T]): Promise<void>;
    processQueue(): Promise<void>;
    getQueueStats(): Promise<NotificationQueueStatsResponseDto>;
}
//# sourceMappingURL=notification-queue.service.interface.d.ts.map