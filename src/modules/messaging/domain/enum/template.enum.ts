// src/modules/messaging/domain/enum/template.enum.ts

export const NOTIFICATION_TEMPLATE_CHANNELS = ['email', 'in_app'] as const;
export type NotificationTemplateChannel = typeof NOTIFICATION_TEMPLATE_CHANNELS[number];
