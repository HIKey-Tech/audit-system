// src/modules/messaging/service/interface/notification.service.interface.ts
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
  markNotificationRead(notificationId: string, userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
}
