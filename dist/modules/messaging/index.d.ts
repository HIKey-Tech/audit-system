import { Router } from 'express';
export declare const createMessagingModule: () => Router;
export { NotificationService, notificationService, } from './service/implementation/notification.service';
export { NotificationQueueService, notificationQueueService, } from './service/implementation/notification-queue.service';
export { TemplateService, templateService, } from './service/implementation/template.service';
export type { INotificationService } from './service/interface/notification.service.interface';
export type { INotificationQueueService } from './service/interface/notification-queue.service.interface';
export type { ITemplateService } from './service/interface/template.service.interface';
//# sourceMappingURL=index.d.ts.map