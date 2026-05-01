"use strict";
// src/modules/messaging/dto/response/template.response.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTemplateToResponse = void 0;
const mapTemplateToResponse = (template) => ({
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
exports.mapTemplateToResponse = mapTemplateToResponse;
//# sourceMappingURL=template.response.dto.js.map