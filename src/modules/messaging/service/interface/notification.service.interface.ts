// src/modules/messaging/service/interface/notification.service.interface.ts
import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { NotificationQueryDto } from '../../dto/request/notification.request.dto';
import { NotificationResponseDto } from '../../dto/response/notification.response.dto';

export interface SendEmailDto {
  to: string | string[];
  subject: string;
  template?: string;
  html?: string;
  text?: string;
  data?: Record<string, unknown>;
}

export interface CreateInAppNotificationDto {
  userId: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'error' | 'success';
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface INotificationService {
  sendEmail(dto: SendEmailDto): Promise<void>;
  sendInAppNotification(dto: CreateInAppNotificationDto): Promise<void>;
  listForUser(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<{ notifications: NotificationResponseDto[]; meta: PaginationMeta }>;
  markNotificationRead(notificationId: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<number>;
  getUnreadCount(userId: string): Promise<number>;
}
