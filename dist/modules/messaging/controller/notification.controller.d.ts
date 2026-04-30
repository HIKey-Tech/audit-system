import { Router } from 'express';
import { INotificationService } from '../service/interface/notification.service.interface';
import { INotificationQueueService } from '../service/interface/notification-queue.service.interface';
export declare class NotificationController {
    private readonly notificationService;
    private readonly notificationQueueService;
    readonly router: Router;
    constructor(notificationService: INotificationService, notificationQueueService: INotificationQueueService);
    private _registerRoutes;
    private _listNotifications;
    private _getUnreadCount;
    private _markRead;
    private _markAllRead;
    private _getQueueStats;
}
//# sourceMappingURL=notification.controller.d.ts.map