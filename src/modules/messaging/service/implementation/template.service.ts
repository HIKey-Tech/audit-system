// src/modules/messaging/service/implementation/template.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  parsePagination,
  buildPaginationMeta,
} from '../../../../shared/types/api-response.type';
import { ITemplateService } from '../interface/template.service.interface';
import {
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  TemplateQueryDto,
} from '../../dto/request/template.request.dto';
import {
  NotificationTemplateResponseDto,
  mapTemplateToResponse,
} from '../../dto/response/template.response.dto';
import { NotificationTemplateChannel } from '../../domain/enum/template.enum';

export class TemplateService implements ITemplateService {
  async createTemplate(
    dto: CreateTemplateRequestDto,
    createdBy: string,
  ): Promise<NotificationTemplateResponseDto> {
    const existing = await prisma.notification_Template.findUnique({
      where: { event_key_channel: { event_key: dto.eventKey, channel: dto.channel } },
    });

    if (existing && existing.deleted_at === null) {
      throw AppError.conflict(
        `Notification template for event '${dto.eventKey}' on channel '${dto.channel}' already exists`,
      );
    }

    const data: Prisma.Notification_TemplateUncheckedCreateInput = {
      event_key: dto.eventKey,
      channel: dto.channel,
      name: dto.name,
      subject: dto.subject ?? null,
      body: dto.body,
      description: dto.description ?? null,
      is_active: dto.isActive ?? true,
      created_by_id: createdBy,
    };

    const template = existing
      ? await prisma.notification_Template.update({
          where: { id: existing.id },
          data: {
            ...data,
            updated_by_id: createdBy,
            deleted_at: null,
          },
        })
      : await prisma.notification_Template.create({ data });

    logger.info('Notification template created', {
      templateId: template.id,
      eventKey: template.event_key,
      channel: template.channel,
      actorId: createdBy,
    });

    return mapTemplateToResponse(template);
  }

  async updateTemplate(
    id: string,
    dto: UpdateTemplateRequestDto,
    updatedBy: string,
  ): Promise<NotificationTemplateResponseDto> {
    await this._assertTemplateExists(id);

    const template = await prisma.notification_Template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_by_id: updatedBy,
      },
    });

    logger.info('Notification template updated', {
      templateId: template.id,
      actorId: updatedBy,
    });

    return mapTemplateToResponse(template);
  }

  async deactivateTemplate(id: string, updatedBy: string): Promise<void> {
    await this._assertTemplateExists(id);

    await prisma.notification_Template.update({
      where: { id },
      data: {
        is_active: false,
        deleted_at: new Date(),
        updated_by_id: updatedBy,
      },
    });

    logger.info('Notification template deactivated', {
      templateId: id,
      actorId: updatedBy,
    });
  }

  async getTemplateByEventAndChannel(
    eventKey: string,
    channel: NotificationTemplateChannel,
  ): Promise<NotificationTemplateResponseDto | null> {
    const template = await prisma.notification_Template.findFirst({
      where: {
        event_key: eventKey,
        channel,
        is_active: true,
        deleted_at: null,
      },
    });

    return template ? mapTemplateToResponse(template) : null;
  }

  async getTemplateById(id: string): Promise<NotificationTemplateResponseDto> {
    const template = await prisma.notification_Template.findUnique({
      where: { id },
    });

    if (!template || template.deleted_at !== null) {
      throw AppError.notFound('Notification template');
    }

    return mapTemplateToResponse(template);
  }

  async listTemplates(
    query: TemplateQueryDto,
  ): Promise<{ templates: NotificationTemplateResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where: Prisma.Notification_TemplateWhereInput = {
      deleted_at: null,
      ...(query.channel && { channel: query.channel }),
      ...(query.eventKey && { event_key: { contains: query.eventKey } }),
      ...(query.isActive !== undefined && { is_active: query.isActive }),
    };

    const [total, templates] = await prisma.$transaction([
      prisma.notification_Template.count({ where }),
      prisma.notification_Template.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      templates: templates.map(mapTemplateToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  private async _assertTemplateExists(id: string): Promise<void> {
    const template = await prisma.notification_Template.findUnique({
      where: { id },
      select: { id: true, deleted_at: true },
    });

    if (!template || template.deleted_at !== null) {
      throw AppError.notFound('Notification template');
    }
  }
}

export const templateService = new TemplateService();
