"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateService = exports.TemplateService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const template_response_dto_1 = require("../../dto/response/template.response.dto");
class TemplateService {
    async createTemplate(dto, createdBy) {
        const existing = await prisma_client_1.prisma.notification_Template.findUnique({
            where: { event_key_channel: { event_key: dto.eventKey, channel: dto.channel } },
        });
        if (existing && existing.deleted_at === null) {
            throw app_error_1.AppError.conflict(`Notification template for event '${dto.eventKey}' on channel '${dto.channel}' already exists`);
        }
        const data = {
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
            ? await prisma_client_1.prisma.notification_Template.update({
                where: { id: existing.id },
                data: {
                    ...data,
                    updated_by_id: createdBy,
                    deleted_at: null,
                },
            })
            : await prisma_client_1.prisma.notification_Template.create({ data });
        logger_util_1.logger.info('Notification template created', {
            templateId: template.id,
            eventKey: template.event_key,
            channel: template.channel,
            actorId: createdBy,
        });
        return (0, template_response_dto_1.mapTemplateToResponse)(template);
    }
    async updateTemplate(id, dto, updatedBy) {
        await this._assertTemplateExists(id);
        const template = await prisma_client_1.prisma.notification_Template.update({
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
        logger_util_1.logger.info('Notification template updated', {
            templateId: template.id,
            actorId: updatedBy,
        });
        return (0, template_response_dto_1.mapTemplateToResponse)(template);
    }
    async deactivateTemplate(id, updatedBy) {
        await this._assertTemplateExists(id);
        await prisma_client_1.prisma.notification_Template.update({
            where: { id },
            data: {
                is_active: false,
                deleted_at: new Date(),
                updated_by_id: updatedBy,
            },
        });
        logger_util_1.logger.info('Notification template deactivated', {
            templateId: id,
            actorId: updatedBy,
        });
    }
    async getTemplateByEventAndChannel(eventKey, channel) {
        const template = await prisma_client_1.prisma.notification_Template.findFirst({
            where: {
                event_key: eventKey,
                channel,
                is_active: true,
                deleted_at: null,
            },
        });
        return template ? (0, template_response_dto_1.mapTemplateToResponse)(template) : null;
    }
    async getTemplateById(id) {
        const template = await prisma_client_1.prisma.notification_Template.findUnique({
            where: { id },
        });
        if (!template || template.deleted_at !== null) {
            throw app_error_1.AppError.notFound('Notification template');
        }
        return (0, template_response_dto_1.mapTemplateToResponse)(template);
    }
    async listTemplates(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            deleted_at: null,
            ...(query.channel && { channel: query.channel }),
            ...(query.eventKey && { event_key: { contains: query.eventKey } }),
            ...(query.isActive !== undefined && { is_active: query.isActive }),
        };
        const [total, templates] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.notification_Template.count({ where }),
            prisma_client_1.prisma.notification_Template.findMany({
                where,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            templates: templates.map(template_response_dto_1.mapTemplateToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async _assertTemplateExists(id) {
        const template = await prisma_client_1.prisma.notification_Template.findUnique({
            where: { id },
            select: { id: true, deleted_at: true },
        });
        if (!template || template.deleted_at !== null) {
            throw app_error_1.AppError.notFound('Notification template');
        }
    }
}
exports.TemplateService = TemplateService;
exports.templateService = new TemplateService();
//# sourceMappingURL=template.service.js.map