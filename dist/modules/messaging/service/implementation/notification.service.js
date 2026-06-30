"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const app_error_1 = require("../../../../shared/errors/app.error");
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const notification_response_dto_1 = require("../../dto/response/notification.response.dto");
class NotificationService {
    transporter;
    constructor() {
        this.transporter = nodemailer_1.default.createTransport({
            host: app_config_1.config.email.host,
            port: app_config_1.config.email.port,
            secure: app_config_1.config.email.secure,
            auth: app_config_1.config.email.user
                ? { user: app_config_1.config.email.user, pass: app_config_1.config.email.password }
                : undefined,
            // Pool connections so a batch drain reuses sockets instead of opening
            // one per message.
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 15_000,
        });
    }
    async sendEmail(dto) {
        const logEntry = await prisma_client_1.prisma.email_Log.create({
            data: {
                to_address: Array.isArray(dto.to) ? dto.to.join(', ') : dto.to,
                from_address: app_config_1.config.email.from,
                subject: dto.subject,
                template: dto.template,
                status: 'pending',
            },
        });
        try {
            await this.transporter.sendMail({
                from: app_config_1.config.email.from,
                to: dto.to,
                subject: dto.subject,
                html: dto.html,
                text: dto.text,
            });
            await prisma_client_1.prisma.email_Log.update({
                where: { id: logEntry.id },
                data: { status: 'sent', sent_at: new Date() },
            });
            logger_util_1.logger.info('Email sent', { subject: dto.subject, to: dto.to });
        }
        catch (err) {
            await prisma_client_1.prisma.email_Log.update({
                where: { id: logEntry.id },
                data: { status: 'failed', error: String(err) },
            });
            logger_util_1.logger.error('Email send failed', { err, to: dto.to, subject: dto.subject });
            throw err;
        }
    }
    async sendInAppNotification(dto) {
        await prisma_client_1.prisma.notification.create({
            data: {
                user_id: dto.userId,
                title: dto.title,
                body: dto.body,
                type: dto.type,
                channel: 'in_app',
                reference_type: dto.referenceType,
                reference_id: dto.referenceId,
                metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
            },
        });
    }
    async listForUser(userId, query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            user_id: userId,
            ...(query.isRead !== undefined && { is_read: query.isRead }),
        };
        const [total, notifications] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.notification.count({ where }),
            prisma_client_1.prisma.notification.findMany({
                where,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            notifications: notifications.map(notification_response_dto_1.mapNotificationToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async markNotificationRead(notificationId, userId) {
        const result = await prisma_client_1.prisma.notification.updateMany({
            where: { id: notificationId, user_id: userId },
            data: { is_read: true, read_at: new Date() },
        });
        if (result.count === 0)
            throw app_error_1.AppError.notFound('Notification');
    }
    async markAllRead(userId) {
        const result = await prisma_client_1.prisma.notification.updateMany({
            where: { user_id: userId, is_read: false },
            data: { is_read: true, read_at: new Date() },
        });
        logger_util_1.logger.info('Notifications marked all read', { userId, count: result.count });
        return result.count;
    }
    async getUnreadCount(userId) {
        return prisma_client_1.prisma.notification.count({
            where: { user_id: userId, is_read: false },
        });
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.service.js.map