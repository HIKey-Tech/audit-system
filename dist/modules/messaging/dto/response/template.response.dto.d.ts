export interface NotificationTemplateResponseDto {
    id: string;
    eventKey: string;
    channel: string;
    name: string;
    subject: string | null;
    body: string;
    description: string | null;
    isActive: boolean;
    createdById: string | null;
    updatedById: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}
export declare const mapTemplateToResponse: (template: {
    id: string;
    event_key: string;
    channel: string;
    name: string;
    subject: string | null;
    body: string;
    description: string | null;
    is_active: boolean;
    created_by_id: string | null;
    updated_by_id: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}) => NotificationTemplateResponseDto;
//# sourceMappingURL=template.response.dto.d.ts.map