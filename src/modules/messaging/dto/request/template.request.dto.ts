// src/modules/messaging/dto/request/template.request.dto.ts
import { z } from 'zod';
import { NOTIFICATION_TEMPLATE_CHANNELS } from '../../domain/enum/template.enum';

export const CreateTemplateRequestSchema = z.object({
  eventKey: z.string().min(1).max(200),
  channel: z.enum(NOTIFICATION_TEMPLATE_CHANNELS),
  name: z.string().min(1).max(200),
  subject: z.string().max(500).optional(),
  body: z.string().min(1),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const UpdateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().min(1).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const TemplateQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  channel: z.enum(NOTIFICATION_TEMPLATE_CHANNELS).optional(),
  eventKey: z.string().min(1).max(200).optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['event_key', 'channel', 'name', 'created_at', 'updated_at']).default('event_key'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateTemplateRequestDto = z.infer<typeof CreateTemplateRequestSchema>;
export type UpdateTemplateRequestDto = z.infer<typeof UpdateTemplateRequestSchema>;
export type TemplateQueryDto = z.infer<typeof TemplateQuerySchema>;
