// src/modules/messaging/dto/response/notification.response.dto.ts

export interface NotificationResponseDto {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  channel: string;
  isRead: boolean;
  readAt: string | null;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Mapper: Prisma model → Response DTO
export const mapNotificationToResponse = (notification: {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  channel: string;
  is_read: boolean;
  read_at: Date | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: string | null;
  created_at: Date;
}): NotificationResponseDto => {
  let parsedMetadata: Record<string, unknown> | null = null;
  if (notification.metadata) {
    try {
      const parsed: unknown = JSON.parse(notification.metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parsedMetadata = parsed as Record<string, unknown>;
      }
    } catch {
      parsedMetadata = null;
    }
  }

  return {
    id: notification.id,
    userId: notification.user_id,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    channel: notification.channel,
    isRead: notification.is_read,
    readAt: notification.read_at?.toISOString() ?? null,
    referenceType: notification.reference_type,
    referenceId: notification.reference_id,
    metadata: parsedMetadata,
    createdAt: notification.created_at.toISOString(),
  };
};
