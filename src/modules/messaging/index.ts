// src/modules/messaging/index.ts
import { Router } from 'express';
import { notificationService } from './service/implementation/notification.service';
import { notificationQueueService } from './service/implementation/notification-queue.service';
import { NotificationController } from './controller/notification.controller';

export const createMessagingModule = (): Router => {
  const router = Router();

  // Controllers
  const notificationController = new NotificationController(
    notificationService,
    notificationQueueService,
  );

  // Mount
  router.use('/notifications', notificationController.router);

  return router;
};

// Re-export for use in other modules
export {
  NotificationService,
  notificationService,
} from './service/implementation/notification.service';
export {
  NotificationQueueService,
  notificationQueueService,
} from './service/implementation/notification-queue.service';
export type { INotificationService } from './service/interface/notification.service.interface';
export type { INotificationQueueService } from './service/interface/notification-queue.service.interface';
