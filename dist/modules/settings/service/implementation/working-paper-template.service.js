"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workingPaperTemplateService = exports.WorkingPaperTemplateService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const settings_response_dto_1 = require("../../dto/response/settings.response.dto");
const settings_utility_1 = require("../../utility/settings.utility");
class WorkingPaperTemplateService {
    async createTemplate(dto, createdBy) {
        const existing = await prisma_client_1.prisma.working_Paper_Template.findUnique({
            where: { name: dto.name },
        });
        if (existing && existing.deleted_at === null) {
            throw app_error_1.AppError.conflict(`Working paper template with name '${dto.name}' already exists`);
        }
        const template = await prisma_client_1.prisma.$transaction(async (tx) => {
            const data = {
                name: dto.name,
                description: dto.description ?? null,
                audit_type: dto.auditType,
                sections: (0, settings_utility_1.stringifyJson)(dto.sections),
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
        logger_util_1.logger.info('Working paper template created', {
            templateId: template.id,
            auditType: template.audit_type,
            actorId: createdBy,
        });
        return (0, settings_response_dto_1.mapWorkingPaperTemplateToResponse)(template);
    }
    async updateTemplate(id, dto, updatedBy) {
        await this._assertTemplateExists(id);
        if (dto.name) {
            const clash = await prisma_client_1.prisma.working_Paper_Template.findFirst({
                where: { name: dto.name, id: { not: id }, deleted_at: null },
                select: { id: true },
            });
            if (clash) {
                throw app_error_1.AppError.conflict(`Working paper template with name '${dto.name}' already exists`);
            }
        }
        const template = await prisma_client_1.prisma.$transaction(async (tx) => {
            const saved = await tx.working_Paper_Template.update({
                where: { id },
                data: {
                    ...(dto.name !== undefined && { name: dto.name }),
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.auditType !== undefined && { audit_type: dto.auditType }),
                    ...(dto.sections !== undefined && { sections: (0, settings_utility_1.stringifyJson)(dto.sections) }),
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
        logger_util_1.logger.info('Working paper template updated', {
            templateId: template.id,
            actorId: updatedBy,
        });
        return (0, settings_response_dto_1.mapWorkingPaperTemplateToResponse)(template);
    }
    async deactivateTemplate(id, updatedBy) {
        await this._assertTemplateExists(id);
        await prisma_client_1.prisma.working_Paper_Template.update({
            where: { id },
            data: {
                is_active: false,
                is_default: false,
                deleted_at: new Date(),
                updated_by_id: updatedBy,
            },
        });
        logger_util_1.logger.info('Working paper template deactivated', { templateId: id, actorId: updatedBy });
    }
    async setDefaultTemplate(id, updatedBy) {
        const existing = await prisma_client_1.prisma.working_Paper_Template.findFirst({
            where: { id, deleted_at: null },
        });
        if (!existing)
            throw app_error_1.AppError.notFound('Working paper template');
        const template = await prisma_client_1.prisma.$transaction(async (tx) => {
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
        logger_util_1.logger.info('Working paper default template changed', {
            templateId: id,
            auditType: template.audit_type,
            actorId: updatedBy,
        });
        return (0, settings_response_dto_1.mapWorkingPaperTemplateToResponse)(template);
    }
    async getTemplateById(id) {
        const template = await prisma_client_1.prisma.working_Paper_Template.findFirst({
            where: { id, deleted_at: null },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Working paper template');
        return (0, settings_response_dto_1.mapWorkingPaperTemplateToResponse)(template);
    }
    async getDefaultTemplate(auditType) {
        const template = await prisma_client_1.prisma.working_Paper_Template.findFirst({
            where: {
                audit_type: auditType,
                is_active: true,
                is_default: true,
                deleted_at: null,
            },
            orderBy: { updated_at: 'desc' },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Default working paper template');
        return (0, settings_response_dto_1.mapWorkingPaperTemplateToResponse)(template);
    }
    async listTemplates(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            deleted_at: null,
            ...(query.auditType && { audit_type: query.auditType }),
            ...(query.isActive !== undefined && { is_active: query.isActive }),
        };
        const [total, templates] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.working_Paper_Template.count({ where }),
            prisma_client_1.prisma.working_Paper_Template.findMany({
                where,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            templates: templates.map(settings_response_dto_1.mapWorkingPaperTemplateToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async _assertTemplateExists(id) {
        const template = await prisma_client_1.prisma.working_Paper_Template.findFirst({
            where: { id, deleted_at: null },
            select: { id: true },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Working paper template');
    }
}
exports.WorkingPaperTemplateService = WorkingPaperTemplateService;
exports.workingPaperTemplateService = new WorkingPaperTemplateService();
//# sourceMappingURL=working-paper-template.service.js.map