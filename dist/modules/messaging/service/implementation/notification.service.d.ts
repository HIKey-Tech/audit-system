import { INotificationService, SendEmailDto, CreateInAppNotificationDto } from '../interface/notification.service.interface';
export declare class NotificationService implements INotificationService {
    private readonly transporter;
    constructor();
    sendEmail(dto: SendEmailDto): Promise<void>;
    sendInAppNotification(dto: CreateInAppNotificationDto): Promise<void>;
    markNotificationRead(notificationId: string, userId: string): Promise<void>;
    getUnreadCount(userId: string): Promise<number>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map