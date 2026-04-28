// src/modules/messaging/service/implementation/notification.service.ts
import nodemailer from 'nodemailer';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import {
  INotificationService,
  SendEmailDto,
  CreateInAppNotificationDto,
} from '../interface/notification.service.interface';

export class NotificationService implements INotificationService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: config.email.user
        ? { user: config.email.user, pass: config.email.password }
        : undefined,
    });
  }

  async sendEmail(dto: SendEmailDto): Promise<void> {
    const logEntry = await prisma.email_Log.create({
      data: {
        to_address: Array.isArray(dto.to) ? dto.to.join(', ') : dto.to,
        from_address: config.email.from,
        subject: dto.subject,
        template: dto.template,
        status: 'pending',
      },
    });

    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to: dto.to,
        subject: dto.subject,
        html: dto.html,
        text: dto.text,
      });

      await prisma.email_Log.update({
        where: { id: logEntry.id },
        data: { status: 'sent', sent_at: new Date() },
      });

      logger.info('Email sent', { subject: dto.subject, to: dto.to });
    } catch (err) {
      await prisma.email_Log.update({
        where: { id: logEntry.id },
        data: { status: 'failed', error: String(err) },
      });
      logger.error('Email send failed', { err, to: dto.to, subject: dto.subject });
      throw err;
    }
  }

  async sendInAppNotification(dto: CreateInAppNotificationDto): Promise<void> {
    await prisma.notification.create({
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

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
  }
}

export const notificationService = new NotificationService();
