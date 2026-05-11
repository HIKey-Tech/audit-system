"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportTemplateService = exports.ReportTemplateService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const settings_response_dto_1 = require("../../dto/response/settings.response.dto");
const settings_utility_1 = require("../../utility/settings.utility");
const settings_utility_2 = require("../../utility/settings.utility");
class ReportTemplateService {
    async createTemplate(dto, createdBy) {
        const existing = await prisma_client_1.prisma.report_Template.findUnique({
            where: { name: dto.name },
        });
        if (existing && existing.deleted_at === null) {
            throw app_error_1.AppError.conflict(`Report template with name '${dto.name}' already exists`);
        }
        const template = await prisma_client_1.prisma.$transaction(async (tx) => {
            const data = {
                name: dto.name,
                description: dto.description ?? null,
                sections: (0, settings_utility_1.stringifyJson)((0, settings_utility_2.toStoredReportTemplateSections)(dto.sections)),
                header_config: dto.headerConfig === undefined || dto.headerConfig === null
                    ? null
                    : (0, settings_utility_1.stringifyJson)(dto.headerConfig),
                footer_config: dto.footerConfig === undefined || dto.footerConfig === null
                    ? null
                    : (0, settings_utility_1.stringifyJson)(dto.footerConfig),
                signature_config: dto.signatureConfig === undefined || dto.signatureConfig === null
                    ? null
                    : (0, settings_utility_1.stringifyJson)(dto.signatureConfig),
                available_variables: (0, settings_utility_1.stringifyJson)(dto.availableVariables),
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
        logger_util_1.logger.info('Report template created', { templateId: template.id, actorId: createdBy });
        return (0, settings_response_dto_1.mapReportTemplateToResponse)(template);
    }
    async updateTemplate(id, dto, updatedBy) {
        await this._assertTemplateExists(id);
        if (dto.name) {
            const clash = await prisma_client_1.prisma.report_Template.findFirst({
                where: { name: dto.name, id: { not: id } },
                select: { id: true },
            });
            if (clash) {
                throw app_error_1.AppError.conflict(`Report template with name '${dto.name}' already exists`);
            }
        }
        const template = await prisma_client_1.prisma.$transaction(async (tx) => {
            const saved = await tx.report_Template.update({
                where: { id },
                data: {
                    ...(dto.name !== undefined && { name: dto.name }),
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.sections !== undefined && {
                        sections: (0, settings_utility_1.stringifyJson)((0, settings_utility_2.toStoredReportTemplateSections)(dto.sections)),
                    }),
                    ...(dto.headerConfig !== undefined && {
                        header_config: dto.headerConfig === null ? null : (0, settings_utility_1.stringifyJson)(dto.headerConfig),
                    }),
                    ...(dto.footerConfig !== undefined && {
                        footer_config: dto.footerConfig === null ? null : (0, settings_utility_1.stringifyJson)(dto.footerConfig),
                    }),
                    ...(dto.signatureConfig !== undefined && {
                        signature_config: dto.signatureConfig === null ? null : (0, settings_utility_1.stringifyJson)(dto.signatureConfig),
                    }),
                    ...(dto.availableVariables !== undefined && {
                        available_variables: (0, settings_utility_1.stringifyJson)(dto.availableVariables),
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
        logger_util_1.logger.info('Report template updated', { templateId: template.id, actorId: updatedBy });
        return (0, settings_response_dto_1.mapReportTemplateToResponse)(template);
    }
    async deactivateTemplate(id, updatedBy) {
        await this._assertTemplateExists(id);
        await prisma_client_1.prisma.report_Template.update({
            where: { id },
            data: {
                is_active: false,
                is_default: false,
                deleted_at: new Date(),
                updated_by_id: updatedBy,
            },
        });
        logger_util_1.logger.info('Report template deactivated', { templateId: id, actorId: updatedBy });
    }
    async setDefaultTemplate(id, updatedBy) {
        const existing = await prisma_client_1.prisma.report_Template.findFirst({
            where: { id, deleted_at: null },
        });
        if (!existing)
            throw app_error_1.AppError.notFound('Report template');
        const template = await prisma_client_1.prisma.$transaction(async (tx) => {
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
        logger_util_1.logger.info('Report default template changed', { templateId: id, actorId: updatedBy });
        return (0, settings_response_dto_1.mapReportTemplateToResponse)(template);
    }
    async getTemplateById(id) {
        const template = await prisma_client_1.prisma.report_Template.findFirst({
            where: { id, deleted_at: null },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Report template');
        return (0, settings_response_dto_1.mapReportTemplateToResponse)(template);
    }
    async getDefaultTemplate() {
        const template = await prisma_client_1.prisma.report_Template.findFirst({
            where: {
                is_active: true,
                is_default: true,
                deleted_at: null,
            },
            orderBy: { updated_at: 'desc' },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Default report template');
        return (0, settings_response_dto_1.mapReportTemplateToResponse)(template);
    }
    async listTemplates(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            deleted_at: null,
            ...(query.isActive !== undefined && { is_active: query.isActive }),
        };
        const [total, templates] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.report_Template.count({ where }),
            prisma_client_1.prisma.report_Template.findMany({
                where,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            templates: templates.map(settings_response_dto_1.mapReportTemplateToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async getAvailableVariables() {
        const template = await prisma_client_1.prisma.report_Template.findFirst({
            where: {
                is_active: true,
                is_default: true,
                deleted_at: null,
            },
            select: { available_variables: true },
            orderBy: { updated_at: 'desc' },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Default report template');
        return (0, settings_utility_1.asReportVariables)(template.available_variables);
    }
    async _assertTemplateExists(id) {
        const template = await prisma_client_1.prisma.report_Template.findFirst({
            where: { id, deleted_at: null },
            select: { id: true },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Report template');
    }
}
exports.ReportTemplateService = ReportTemplateService;
exports.reportTemplateService = new ReportTemplateService();
//# sourceMappingURL=report-template.service.js.map