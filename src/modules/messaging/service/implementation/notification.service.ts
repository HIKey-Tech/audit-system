// src/modules/messaging/service/implementation/notification.service.ts
import { Prisma } from '@prisma/client';
import nodemailer from 'nodemailer';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import {
  PaginationMeta,
  parsePagination,
  buildPaginationMeta,
} from '../../../../shared/types/api-response.type';
import {
  INotificationService,
  SendEmailDto,
  CreateInAppNotificationDto,
} from '../interface/notification.service.interface';
import { NotificationQueryDto } from '../../dto/request/notification.request.dto';
import {
  NotificationResponseDto,
  mapNotificationToResponse,
} from '../../dto/response/notification.response.dto';

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
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
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

  async listForUser(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<{ notifications: NotificationResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where: Prisma.NotificationWhereInput = {
      user_id: userId,
      ...(query.isRead !== undefined && { is_read: query.isRead }),
    };

    const [total, notifications] = await prisma.$transaction([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      notifications: notifications.map(mapNotificationToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });

    logger.info('Notifications marked all read', { userId, count: result.count });
    return result.count;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
  }
}

export const notificationService = new NotificationService();
