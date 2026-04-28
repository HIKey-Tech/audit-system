"use strict";
// src/modules/messaging/dto/response/notification.response.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapNotificationToResponse = void 0;
// Mapper: Prisma model → Response DTO
const mapNotificationToResponse = (notification) => {
    let parsedMetadata = null;
    if (notification.metadata) {
        try {
            const parsed = JSON.parse(notification.metadata);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                parsedMetadata = parsed;
            }
        }
        catch {
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
exports.mapNotificationToResponse = mapNotificationToResponse;
//# sourceMappingURL=notification.response.dto.js.map