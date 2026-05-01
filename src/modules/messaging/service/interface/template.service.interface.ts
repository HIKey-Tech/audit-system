// src/modules/messaging/service/interface/template.service.interface.ts
import { PaginationMeta } from '../../../../shared/types/api-response.type';
import {
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  TemplateQueryDto,
} from '../../dto/request/template.request.dto';
import { NotificationTemplateResponseDto } from '../../dto/response/template.response.dto';
import { NotificationTemplateChannel } from '../../domain/enum/template.enum';

export interface ITemplateService {
  createTemplate(
    dto: CreateTemplateRequestDto,
    createdBy: string,
  ): Promise<NotificationTemplateResponseDto>;

  updateTemplate(
    id: string,
    dto: UpdateTemplateRequestDto,
    updatedBy: string,
  ): Promise<NotificationTemplateResponseDto>;

  deactivateTemplate(id: string, updatedBy: string): Promise<void>;

  getTemplateByEventAndChannel(
    eventKey: string,
    channel: NotificationTemplateChannel,
  ): Promise<NotificationTemplateResponseDto | null>;

  getTemplateById(id: string): Promise<NotificationTemplateResponseDto>;

  listTemplates(
    query: TemplateQueryDto,
  ): Promise<{ templates: NotificationTemplateResponseDto[]; meta: PaginationMeta }>;
}
