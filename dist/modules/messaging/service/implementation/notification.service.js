"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
// src/modules/messaging/service/implementation/notification.service.ts
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
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
            logger_util_1.logger.error('Email send failed', { err, subject: dto.subject });
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
    async markNotificationRead(notificationId, userId) {
        await prisma_client_1.prisma.notification.updateMany({
            where: { id: notificationId, user_id: userId },
            data: { is_read: true, read_at: new Date() },
        });
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