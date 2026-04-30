"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
// src/modules/messaging/controller/notification.controller.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const validate_middleware_1 = require("../../../shared/middleware/validate.middleware");
const api_response_type_1 = require("../../../shared/types/api-response.type");
const notification_request_dto_1 = require("../dto/request/notification.request.dto");
class NotificationController {
    notificationService;
    notificationQueueService;
    router;
    constructor(notificationService, notificationQueueService) {
        this.notificationService = notificationService;
        this.notificationQueueService = notificationQueueService;
        this.router = (0, express_1.Router)();
        this._registerRoutes();
    }
    _registerRoutes() {
        // All notification routes require authentication
        this.router.use(auth_middleware_1.authenticate);
        /**
         * @route  GET /notifications/unread-count
         * @desc   Get unread notification count for the current user
         * @access Private — notification:read
         */
        this.router.get('/unread-count', (0, auth_middleware_1.requirePermission)('notification:read'), this._getUnreadCount.bind(this));
        /**
         * @route  POST /notifications/read-all
         * @desc   Mark all notifications as read for the current user
         * @access Private — notification:read
         */
        this.router.post('/read-all', (0, auth_middleware_1.requirePermission)('notification:read'), this._markAllRead.bind(this));
        /**
         * @route  GET /notifications/queue/stats
         * @desc   Get notification queue counts by status
         * @access Private â€” notification:read
         */
        this.router.get('/queue/stats', (0, auth_middleware_1.requirePermission)('notification:read'), this._getQueueStats.bind(this));
        /**
         * @route  GET /notifications
         * @desc   List notifications for the current user (paginated, filterable by isRead)
         * @access Private — notification:read
         */
        this.router.get('/', (0, auth_middleware_1.requirePermission)('notification:read'), (0, validate_middleware_1.validate)(notification_request_dto_1.NotificationQuerySchema, 'query'), this._listNotifications.bind(this));
        /**
         * @route  POST /notifications/:id/read
         * @desc   Mark a single notification as read
         * @access Private — notification:read
         */
        this.router.post('/:id/read', (0, auth_middleware_1.requirePermission)('notification:read'), this._markRead.bind(this));
    }
    async _listNotifications(req, res, next) {
        try {
            const { notifications, meta } = await this.notificationService.listForUser(req.user.id, req.query);
            res.status(200).json({ ...(0, api_response_type_1.buildResponse)(notifications), meta });
        }
        catch (err) {
            next(err);
        }
    }
    async _getUnreadCount(req, res, next) {
        try {
            const count = await this.notificationService.getUnreadCount(req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)({ count }));
        }
        catch (err) {
            next(err);
        }
    }
    async _markRead(req, res, next) {
        try {
            await this.notificationService.markNotificationRead(req.params.id, req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)(null, 'Notification marked as read'));
        }
        catch (err) {
            next(err);
        }
    }
    async _markAllRead(req, res, next) {
        try {
            const count = await this.notificationService.markAllRead(req.user.id);
            res.status(200).json((0, api_response_type_1.buildResponse)({ count }, 'All notifications marked as read'));
        }
        catch (err) {
            next(err);
        }
    }
    async _getQueueStats(_req, res, next) {
        try {
            const stats = await this.notificationQueueService.getQueueStats();
            res.status(200).json((0, api_response_type_1.buildResponse)(stats));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.NotificationController = NotificationController;
//# sourceMappingURL=notification.controller.js.map