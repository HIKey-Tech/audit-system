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
export declare const mapNotificationToResponse: (notification: {
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
}) => NotificationResponseDto;
//# sourceMappingURL=notification.response.dto.d.ts.map