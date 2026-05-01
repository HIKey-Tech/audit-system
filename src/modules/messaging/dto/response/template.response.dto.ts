// src/modules/messaging/dto/response/template.response.dto.ts

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

export const mapTemplateToResponse = (template: {
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
}): NotificationTemplateResponseDto => ({
  id: template.id,
  eventKey: template.event_key,
  channel: template.channel,
  name: template.name,
  subject: template.subject,
  body: template.body,
  description: template.description,
  isActive: template.is_active,
  createdById: template.created_by_id,
  updatedById: template.updated_by_id,
  createdAt: template.created_at.toISOString(),
  updatedAt: template.updated_at.toISOString(),
  deletedAt: template.deleted_at?.toISOString() ?? null,
});
