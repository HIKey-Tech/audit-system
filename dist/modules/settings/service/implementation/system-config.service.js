"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemConfigService = exports.SystemConfigService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const settings_response_dto_1 = require("../../dto/response/settings.response.dto");
class SystemConfigService {
    async getConfig(key) {
        const config = await prisma_client_1.prisma.system_Config.findUnique({
            where: { key },
        });
        if (!config)
            throw app_error_1.AppError.notFound('System config');
        return (0, settings_response_dto_1.mapSystemConfigToResponse)(config);
    }
    async getAllConfig(includePrivate) {
        const configs = await prisma_client_1.prisma.system_Config.findMany({
            where: includePrivate ? undefined : { is_public: true },
            orderBy: { key: 'asc' },
        });
        return configs.map(settings_response_dto_1.mapSystemConfigToResponse);
    }
    async updateConfig(key, value, updatedBy) {
        await this._assertConfigExists(key);
        const config = await prisma_client_1.prisma.system_Config.update({
            where: { key },
            data: {
                value,
                updated_by_id: updatedBy,
            },
        });
        logger_util_1.logger.info('System config updated', { key, actorId: updatedBy });
        return (0, settings_response_dto_1.mapSystemConfigToResponse)(config);
    }
    async bulkUpdateConfig(dto, updatedBy) {
        const keys = dto.configs.map((config) => config.key);
        const existing = await prisma_client_1.prisma.system_Config.findMany({
            where: { key: { in: keys } },
            select: { key: true },
        });
        if (existing.length !== keys.length) {
            const existingKeys = new Set(existing.map((config) => config.key));
            const missingKeys = keys.filter((key) => !existingKeys.has(key));
            throw app_error_1.AppError.badRequest('One or more system config keys are invalid', { missingKeys });
        }
        await prisma_client_1.prisma.$transaction(dto.configs.map((config) => prisma_client_1.prisma.system_Config.update({
            where: { key: config.key },
            data: {
                value: config.value,
                updated_by_id: updatedBy,
            },
        })));
        logger_util_1.logger.info('System config bulk-updated', { keys, actorId: updatedBy });
        const configs = await prisma_client_1.prisma.system_Config.findMany({
            where: { key: { in: keys } },
            orderBy: { key: 'asc' },
        });
        return configs.map(settings_response_dto_1.mapSystemConfigToResponse);
    }
    async _assertConfigExists(key) {
        const config = await prisma_client_1.prisma.system_Config.findUnique({
            where: { key },
            select: { id: true },
        });
        if (!config)
            throw app_error_1.AppError.notFound('System config');
    }
}
exports.SystemConfigService = SystemConfigService;
exports.systemConfigService = new SystemConfigService();
//# sourceMappingURL=system-config.service.js.map