import { AppError } from '../../../../shared/errors/app.error';
import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { INotificationService, SendEmailDto, CreateInAppNotificationDto } from '../interface/notification.service.interface';
import { NotificationQueryDto } from '../../dto/request/notification.request.dto';
import { NotificationResponseDto } from '../../dto/response/notification.response.dto';
/**
 * Raised when no mail server has been configured. It is a deployment state, not
 * a delivery failure, so the queue parks the item as `skipped` instead of
 * retrying it to exhaustion.
 */
export declare class SmtpNotConfiguredError extends AppError {
    constructor();
}
/** The shipped default host is a placeholder: with it and no credentials every send would bounce. */
export declare const isSmtpConfigured: () => boolean;
export declare class NotificationService implements INotificationService {
    private readonly transporter;
    constructor();
    sendEmail(dto: SendEmailDto): Promise<void>;
    sendInAppNotification(dto: CreateInAppNotificationDto): Promise<void>;
    listForUser(userId: string, query: NotificationQueryDto): Promise<{
        notifications: NotificationResponseDto[];
        meta: PaginationMeta;
    }>;
    markNotificationRead(notificationId: string, userId: string): Promise<void>;
    markAllRead(userId: string): Promise<number>;
    getUnreadCount(userId: string): Promise<number>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map