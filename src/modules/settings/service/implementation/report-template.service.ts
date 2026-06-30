import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import {
  PaginationMeta,
  buildPaginationMeta,
  parsePagination,
} from '../../../../shared/types/api-response.type';
import { IReportTemplateService } from '../interface/report-template.service.interface';
import {
  CreateReportTemplateRequestDto,
  ReportTemplateQueryDto,
  UpdateReportTemplateRequestDto,
} from '../../dto/request/settings.request.dto';
import {
  ReportTemplateResponseDto,
  mapReportTemplateToResponse,
} from '../../dto/response/settings.response.dto';
import { ReportTemplateVariable } from '../../domain/entity/settings.entity';
import { asReportVariables, stringifyJson } from '../../utility/settings.utility';
import { toStoredReportTemplateSections } from '../../utility/settings.utility';

export class ReportTemplateService implements IReportTemplateService {
  async createTemplate(
    dto: CreateReportTemplateRequestDto,
    createdBy: string,
  ): Promise<ReportTemplateResponseDto> {
    const existing = await prisma.report_Template.findUnique({
      where: { name: dto.name },
    });

    if (existing && existing.deleted_at === null) {
      throw AppError.conflict(`Report template with name '${dto.name}' already exists`);
    }

    const template = await prisma.$transaction(async (tx) => {
      const data: Prisma.Report_TemplateUncheckedCreateInput = {
        name: dto.name,
        description: dto.description ?? null,
        sections: stringifyJson(toStoredReportTemplateSections(dto.sections)),
        header_config: dto.headerConfig === undefined || dto.headerConfig === null
          ? null
          : stringifyJson(dto.headerConfig),
        footer_config: dto.footerConfig === undefined || dto.footerConfig === null
          ? null
          : stringifyJson(dto.footerConfig),
        signature_config: dto.signatureConfig === undefined || dto.signatureConfig === null
          ? null
          : stringifyJson(dto.signatureConfig),
        available_variables: stringifyJson(dto.availableVariables),
        is_active: dto.isActive ?? true,
        is_default: dto.isDefault ?? false,
        created_by_id: createdBy,
      };

      const saved = existing
        ? await tx.report_Template.update({
            where: { id: existing.id },
            data: {
              ...data,
              updated_by_id: createdBy,
              deleted_at: null,
            },
          })
        : await tx.report_Template.create({ data });

      if (saved.is_default) {
        await tx.report_Template.updateMany({
          where: { id: { not: saved.id } },
          data: { is_default: false },
        });
      }

      return saved;
    });

    logger.info('Report template created', { templateId: template.id, actorId: createdBy });
    return mapReportTemplateToResponse(template);
  }

  async updateTemplate(
    id: string,
    dto: UpdateReportTemplateRequestDto,
    updatedBy: string,
  ): Promise<ReportTemplateResponseDto> {
    await this._assertTemplateExists(id);

    if (dto.name) {
      const clash = await prisma.report_Template.findFirst({
        where: { name: dto.name, id: { not: id }, deleted_at: null },
        select: { id: true },
      });
      if (clash) {
        throw AppError.conflict(`Report template with name '${dto.name}' already exists`);
      }
    }

    const template = await prisma.$transaction(async (tx) => {
      const saved = await tx.report_Template.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.sections !== undefined && {
            sections: stringifyJson(toStoredReportTemplateSections(dto.sections)),
          }),
          ...(dto.headerConfig !== undefined && {
            header_config: dto.headerConfig === null ? null : stringifyJson(dto.headerConfig),
          }),
          ...(dto.footerConfig !== undefined && {
            footer_config: dto.footerConfig === null ? null : stringifyJson(dto.footerConfig),
          }),
          ...(dto.signatureConfig !== undefined && {
            signature_config: dto.signatureConfig === null ? null : stringifyJson(dto.signatureConfig),
          }),
          ...(dto.availableVariables !== undefined && {
            available_variables: stringifyJson(dto.availableVariables),
          }),
          ...(dto.isActive !== undefined && { is_active: dto.isActive }),
          ...(dto.isDefault !== undefined && { is_default: dto.isDefault }),
          updated_by_id: updatedBy,
        },
      });

      if (saved.is_default) {
        await tx.report_Template.updateMany({
          where: { id: { not: saved.id } },
          data: { is_default: false },
        });
      }

      return saved;
    });

    logger.info('Report template updated', { templateId: template.id, actorId: updatedBy });
    return mapReportTemplateToResponse(template);
  }

  async deactivateTemplate(id: string, updatedBy: string): Promise<void> {
    await this._assertTemplateExists(id);

    await prisma.report_Template.update({
      where: { id },
      data: {
        is_active: false,
        is_default: false,
        deleted_at: new Date(),
        updated_by_id: updatedBy,
      },
    });

    logger.info('Report template deactivated', { templateId: id, actorId: updatedBy });
  }

  async setDefaultTemplate(id: string, updatedBy: string): Promise<ReportTemplateResponseDto> {
    const existing = await prisma.report_Template.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) throw AppError.notFound('Report template');

    const template = await prisma.$transaction(async (tx) => {
      await tx.report_Template.updateMany({
        data: { is_default: false },
      });

      return tx.report_Template.update({
        where: { id },
        data: {
          is_default: true,
          is_active: true,
          updated_by_id: updatedBy,
        },
      });
    });

    logger.info('Report default template changed', { templateId: id, actorId: updatedBy });
    return mapReportTemplateToResponse(template);
  }

  async getTemplateById(id: string): Promise<ReportTemplateResponseDto> {
    const template = await prisma.report_Template.findFirst({
      where: { id, deleted_at: null },
    });

    if (!template) throw AppError.notFound('Report template');
    return mapReportTemplateToResponse(template);
  }

  async getDefaultTemplate(): Promise<ReportTemplateResponseDto> {
    const template = await prisma.report_Template.findFirst({
      where: {
        is_active: true,
        is_default: true,
        deleted_at: null,
      },
      orderBy: { updated_at: 'desc' },
    });

    if (!template) throw AppError.notFound('Default report template');
    return mapReportTemplateToResponse(template);
  }

  async listTemplates(
    query: ReportTemplateQueryDto,
  ): Promise<{ templates: ReportTemplateResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where: Prisma.Report_TemplateWhereInput = {
      deleted_at: null,
      ...(query.isActive !== undefined && { is_active: query.isActive }),
    };

    const [total, templates] = await prisma.$transaction([
      prisma.report_Template.count({ where }),
      prisma.report_Template.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      templates: templates.map(mapReportTemplateToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async getAvailableVariables(): Promise<ReportTemplateVariable[]> {
    const template = await prisma.report_Template.findFirst({
      where: {
        is_active: true,
        is_default: true,
        deleted_at: null,
      },
      select: { available_variables: true },
      orderBy: { updated_at: 'desc' },
    });

    if (!template) throw AppError.notFound('Default report template');
    return asReportVariables(template.available_variables);
  }

  private async _assertTemplateExists(id: string): Promise<void> {
    const template = await prisma.report_Template.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });

    if (!template) throw AppError.notFound('Report template');
  }
}

export const reportTemplateService = new ReportTemplateService();
