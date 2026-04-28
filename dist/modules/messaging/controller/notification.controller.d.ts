import { Router } from 'express';
import { INotificationService } from '../service/interface/notification.service.interface';
export declare class NotificationController {
    private readonly notificationService;
    readonly router: Router;
    constructor(notificationService: INotificationService);
    private _registerRoutes;
    private _listNotifications;
    private _getUnreadCount;
    private _markRead;
    private _markAllRead;
}
//# sourceMappingURL=notification.controller.d.ts.map