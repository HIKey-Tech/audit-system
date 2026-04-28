// src/modules/messaging/index.ts
import { Router } from 'express';
import { notificationService } from './service/implementation/notification.service';
import { NotificationController } from './controller/notification.controller';

export const createMessagingModule = (): Router => {
  const router = Router();

  // Controllers
  const notificationController = new NotificationController(notificationService);

  // Mount
  router.use('/notifications', notificationController.router);

  return router;
};

// Re-export for use in other modules
export {
  NotificationService,
  notificationService,
} from './service/implementation/notification.service';
export type { INotificationService } from './service/interface/notification.service.interface';
