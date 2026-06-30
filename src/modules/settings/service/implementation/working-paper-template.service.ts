import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../shared/types/api-response.type';
import { IWorkingPaperTemplateService } from '../interface/working-paper-template.service.interface';
import {
  CreateWorkingPaperTemplateRequestDto,
  UpdateWorkingPaperTemplateRequestDto,
  WorkingPaperTemplateQueryDto,
} from '../../dto/request/settings.request.dto';
import {
  WorkingPaperTemplateResponseDto,
  mapWorkingPaperTemplateToResponse,
} from '../../dto/response/settings.response.dto';
import { SettingsAuditType } from '../../domain/enum/settings.enum';
import { stringifyJson } from '../../utility/settings.utility';

export class WorkingPaperTemplateService implements IWorkingPaperTemplateService {
  async createTemplate(
    dto: CreateWorkingPaperTemplateRequestDto,
    createdBy: string,
  ): Promise<WorkingPaperTemplateResponseDto> {
    const existing = await prisma.working_Paper_Template.findUnique({
      where: { name: dto.name },
    });

    if (existing && existing.deleted_at === null) {
      throw AppError.conflict(`Working paper template with name '${dto.name}' already exists`);
    }

    const template = await prisma.$transaction(async (tx) => {
      const data: Prisma.Working_Paper_TemplateUncheckedCreateInput = {
        name: dto.name,
        description: dto.description ?? null,
        audit_type: dto.auditType,
        sections: stringifyJson(dto.sections),
        is_active: dto.isActive ?? true,
        is_default: dto.isDefault ?? false,
        created_by_id: createdBy,
      };

      const saved = existing
        ? await tx.working_Paper_Template.update({
            where: { id: existing.id },
            data: {
              ...data,
              updated_by_id: createdBy,
              deleted_at: null,
            },
          })
        : await tx.working_Paper_Template.create({ data });

      if (saved.is_default) {
        await tx.working_Paper_Template.updateMany({
          where: {
            audit_type: saved.audit_type,
            id: { not: saved.id },
          },
          data: { is_default: false },
        });
      }

      return saved;
    });

    logger.info('Working paper template created', {
      templateId: template.id,
      auditType: template.audit_type,
      actorId: createdBy,
    });

    return mapWorkingPaperTemplateToResponse(template);
  }

  async updateTemplate(
    id: string,
    dto: UpdateWorkingPaperTemplateRequestDto,
    updatedBy: string,
  ): Promise<WorkingPaperTemplateResponseDto> {
    await this._assertTemplateExists(id);

    if (dto.name) {
      const clash = await prisma.working_Paper_Template.findFirst({
        where: { name: dto.name, id: { not: id }, deleted_at: null },
        select: { id: true },
      });
      if (clash) {
        throw AppError.conflict(`Working paper template with name '${dto.name}' already exists`);
      }
    }

    const template = await prisma.$transaction(async (tx) => {
      const saved = await tx.working_Paper_Template.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.auditType !== undefined && { audit_type: dto.auditType }),
          ...(dto.sections !== undefined && { sections: stringifyJson(dto.sections) }),
          ...(dto.isActive !== undefined && { is_active: dto.isActive }),
          ...(dto.isDefault !== undefined && { is_default: dto.isDefault }),
          updated_by_id: updatedBy,
        },
      });

      if (saved.is_default) {
        await tx.working_Paper_Template.updateMany({
          where: {
            audit_type: saved.audit_type,
            id: { not: saved.id },
          },
          data: { is_default: false },
        });
      }

      return saved;
    });

    logger.info('Working paper template updated', {
      templateId: template.id,
      actorId: updatedBy,
    });

    return mapWorkingPaperTemplateToResponse(template);
  }

  async deactivateTemplate(id: string, updatedBy: string): Promise<void> {
    await this._assertTemplateExists(id);

    await prisma.working_Paper_Template.update({
      where: { id },
      data: {
        is_active: false,
        is_default: false,
        deleted_at: new Date(),
        updated_by_id: updatedBy,
      },
    });

    logger.info('Working paper template deactivated', { templateId: id, actorId: updatedBy });
  }

  async setDefaultTemplate(
    id: string,
    updatedBy: string,
  ): Promise<WorkingPaperTemplateResponseDto> {
    const existing = await prisma.working_Paper_Template.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) throw AppError.notFound('Working paper template');

    const template = await prisma.$transaction(async (tx) => {
      await tx.working_Paper_Template.updateMany({
        where: { audit_type: existing.audit_type },
        data: { is_default: false },
      });

      return tx.working_Paper_Template.update({
        where: { id },
        data: {
          is_default: true,
          is_active: true,
          updated_by_id: updatedBy,
        },
      });
    });

    logger.info('Working paper default template changed', {
      templateId: id,
      auditType: template.audit_type,
      actorId: updatedBy,
    });

    return mapWorkingPaperTemplateToResponse(template);
  }

  async getTemplateById(id: string): Promise<WorkingPaperTemplateResponseDto> {
    const template = await prisma.working_Paper_Template.findFirst({
      where: { id, deleted_at: null },
    });

    if (!template) throw AppError.notFound('Working paper template');
    return mapWorkingPaperTemplateToResponse(template);
  }

  async getDefaultTemplate(auditType: SettingsAuditType): Promise<WorkingPaperTemplateResponseDto> {
    const template = await prisma.working_Paper_Template.findFirst({
      where: {
        audit_type: auditType,
        is_active: true,
        is_default: true,
        deleted_at: null,
      },
      orderBy: { updated_at: 'desc' },
    });

    if (!template) throw AppError.notFound('Default working paper template');
    return mapWorkingPaperTemplateToResponse(template);
  }

  async listTemplates(
    query: WorkingPaperTemplateQueryDto,
  ): Promise<{ templates: WorkingPaperTemplateResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where: Prisma.Working_Paper_TemplateWhereInput = {
      deleted_at: null,
      ...(query.auditType && { audit_type: query.auditType }),
      ...(query.isActive !== undefined && { is_active: query.isActive }),
    };

    const [total, templates] = await prisma.$transaction([
      prisma.working_Paper_Template.count({ where }),
      prisma.working_Paper_Template.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      templates: templates.map(mapWorkingPaperTemplateToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  private async _assertTemplateExists(id: string): Promise<void> {
    const template = await prisma.working_Paper_Template.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });

    if (!template) throw AppError.notFound('Working paper template');
  }
}

export const workingPaperTemplateService = new WorkingPaperTemplateService();
