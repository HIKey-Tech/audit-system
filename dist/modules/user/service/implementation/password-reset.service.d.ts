import { INotificationQueueService } from '../../../messaging/service/interface/notification-queue.service.interface';
import { IPasswordResetService } from '../interface/password-reset.service.interface';
export declare class PasswordResetService implements IPasswordResetService {
    private readonly notificationQueue;
    constructor(notificationQueue: INotificationQueueService);
    requestReset(email: string, ipAddress?: string): Promise<void>;
    resetPassword(token: string, newPassword: string, _ipAddress?: string): Promise<void>;
    private _sendResetEmail;
}
//# sourceMappingURL=password-reset.service.d.ts.map