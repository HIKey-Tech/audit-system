"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const risk_utility_1 = require("../../../utility/risk.utility");
const category_response_dto_1 = require("../../dto/response/category.response.dto");
class CategoryService {
    async createCategory(dto, actor) {
        (0, risk_utility_1.assertHasRole)(actor.roles, risk_utility_1.RISK_ADMIN_ROLES);
        const existing = await prisma_client_1.prisma.risk_Category.findUnique({
            where: { name: dto.name },
            select: { id: true },
        });
        if (existing) {
            throw app_error_1.AppError.conflict(`Risk category '${dto.name}' already exists`);
        }
        const category = await prisma_client_1.prisma.risk_Category.create({
            data: {
                name: dto.name,
                description: dto.description,
                created_by_id: actor.id,
            },
        });
        logger_util_1.logger.info('Risk category created', { categoryId: category.id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'risk.category.create',
            module: 'risk',
            entityType: 'risk_category',
            entityId: category.id,
            newValues: (0, category_response_dto_1.mapRiskCategoryToResponse)(category),
        });
        return (0, category_response_dto_1.mapRiskCategoryToResponse)(category);
    }
    async updateCategory(id, dto, actor) {
        (0, risk_utility_1.assertHasRole)(actor.roles, risk_utility_1.RISK_ADMIN_ROLES);
        await this._assertCategoryExists(id);
        const category = await prisma_client_1.prisma.risk_Category.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.isActive !== undefined && { is_active: dto.isActive }),
            },
        });
        logger_util_1.logger.info('Risk category updated', { categoryId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'risk.category.update',
            module: 'risk',
            entityType: 'risk_category',
            entityId: id,
            newValues: (0, category_response_dto_1.mapRiskCategoryToResponse)(category),
        });
        return (0, category_response_dto_1.mapRiskCategoryToResponse)(category);
    }
    async deactivateCategory(id, actor) {
        (0, risk_utility_1.assertHasRole)(actor.roles, risk_utility_1.RISK_ADMIN_ROLES);
        await this._assertCategoryExists(id);
        await prisma_client_1.prisma.risk_Category.update({
            where: { id },
            data: { is_active: false },
        });
        logger_util_1.logger.info('Risk category deactivated', { categoryId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'risk.category.deactivate',
            module: 'risk',
            entityType: 'risk_category',
            entityId: id,
        });
    }
    async listCategories(filters) {
        const where = {
            ...(filters.isActive !== undefined && { is_active: filters.isActive }),
        };
        const categories = await prisma_client_1.prisma.risk_Category.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        return categories.map(category_response_dto_1.mapRiskCategoryToResponse);
    }
    async _assertCategoryExists(id) {
        const category = await prisma_client_1.prisma.risk_Category.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!category)
            throw app_error_1.AppError.notFound('Risk category');
    }
}
exports.CategoryService = CategoryService;
//# sourceMappingURL=category.service.js.map