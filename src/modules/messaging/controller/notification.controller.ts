// src/modules/messaging/controller/notification.controller.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../../../shared/middleware/auth.middleware';
import { validate } from '../../../shared/middleware/validate.middleware';
import { buildResponse } from '../../../shared/types/api-response.type';
import { INotificationService } from '../service/interface/notification.service.interface';
import { INotificationQueueService } from '../service/interface/notification-queue.service.interface';
import { NotificationQuerySchema } from '../dto/request/notification.request.dto';

export class NotificationController {
  public readonly router: Router;

  constructor(
    private readonly notificationService: INotificationService,
    private readonly notificationQueueService: INotificationQueueService,
  ) {
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // All notification routes require authentication
    this.router.use(authenticate);

    /**
     * @route  GET /notifications/unread-count
     * @desc   Get unread notification count for the current user
     * @access Private — notification:read
     */
    this.router.get(
      '/unread-count',
      requirePermission('notification:read'),
      this._getUnreadCount.bind(this),
    );

    /**
     * @route  POST /notifications/read-all
     * @desc   Mark all notifications as read for the current user
     * @access Private — notification:read
     */
    this.router.post(
      '/read-all',
      requirePermission('notification:update'),
      this._markAllRead.bind(this),
    );

    /**
     * @route  GET /notifications/queue/stats
     * @desc   Get notification queue counts by status
     * @access Private â€” notification:read
     */
    this.router.get(
      '/queue/stats',
      requirePermission('notification_queue:read'),
      this._getQueueStats.bind(this),
    );

    /**
     * @route  GET /notifications
     * @desc   List notifications for the current user (paginated, filterable by isRead)
     * @access Private — notification:read
     */
    this.router.get(
      '/',
      requirePermission('notification:read'),
      validate(NotificationQuerySchema, 'query'),
      this._listNotifications.bind(this),
    );

    /**
     * @route  POST /notifications/:id/read
     * @desc   Mark a single notification as read
     * @access Private — notification:read
     */
    this.router.post(
      '/:id/read',
      requirePermission('notification:update'),
      this._markRead.bind(this),
    );
  }

  private async _listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notifications, meta } = await this.notificationService.listForUser(
        req.user!.id,
        req.query as never,
      );
      res.status(200).json({ ...buildResponse(notifications), meta });
    } catch (err) {
      next(err);
    }
  }

  private async _getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await this.notificationService.getUnreadCount(req.user!.id);
      res.status(200).json(buildResponse({ count }));
    } catch (err) {
      next(err);
    }
  }

  private async _markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.notificationService.markNotificationRead(req.params.id, req.user!.id);
      res.status(200).json(buildResponse(null, 'Notification marked as read'));
    } catch (err) {
      next(err);
    }
  }

  private async _markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await this.notificationService.markAllRead(req.user!.id);
      res.status(200).json(buildResponse({ count }, 'All notifications marked as read'));
    } catch (err) {
      next(err);
    }
  }

  private async _getQueueStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.notificationQueueService.getQueueStats();
      res.status(200).json(buildResponse(stats));
    } catch (err) {
      next(err);
    }
  }
}
