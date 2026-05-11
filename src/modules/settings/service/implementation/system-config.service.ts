import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { ISystemConfigService } from '../interface/system-config.service.interface';
import { BulkUpdateSystemConfigRequestDto } from '../../dto/request/settings.request.dto';
import {
  SystemConfigResponseDto,
  mapSystemConfigToResponse,
} from '../../dto/response/settings.response.dto';

export class SystemConfigService implements ISystemConfigService {
  async getConfig(key: string): Promise<SystemConfigResponseDto> {
    const config = await prisma.system_Config.findUnique({
      where: { key },
    });

    if (!config) throw AppError.notFound('System config');
    return mapSystemConfigToResponse(config);
  }

  async getAllConfig(includePrivate: boolean): Promise<SystemConfigResponseDto[]> {
    const configs = await prisma.system_Config.findMany({
      where: includePrivate ? undefined : { is_public: true },
      orderBy: { key: 'asc' },
    });

    return configs.map(mapSystemConfigToResponse);
  }

  async updateConfig(
    key: string,
    value: string | null,
    updatedBy: string,
  ): Promise<SystemConfigResponseDto> {
    await this._assertConfigExists(key);

    const config = await prisma.system_Config.update({
      where: { key },
      data: {
        value,
        updated_by_id: updatedBy,
      },
    });

    logger.info('System config updated', { key, actorId: updatedBy });
    return mapSystemConfigToResponse(config);
  }

  async bulkUpdateConfig(
    dto: BulkUpdateSystemConfigRequestDto,
    updatedBy: string,
  ): Promise<SystemConfigResponseDto[]> {
    const keys = dto.configs.map((config) => config.key);
    const existing = await prisma.system_Config.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    });

    if (existing.length !== keys.length) {
      const existingKeys = new Set(existing.map((config) => config.key));
      const missingKeys = keys.filter((key) => !existingKeys.has(key));
      throw AppError.badRequest('One or more system config keys are invalid', { missingKeys });
    }

    await prisma.$transaction(
      dto.configs.map((config) =>
        prisma.system_Config.update({
          where: { key: config.key },
          data: {
            value: config.value,
            updated_by_id: updatedBy,
          },
        }),
      ),
    );

    logger.info('System config bulk-updated', { keys, actorId: updatedBy });

    const configs = await prisma.system_Config.findMany({
      where: { key: { in: keys } },
      orderBy: { key: 'asc' },
    });
    return configs.map(mapSystemConfigToResponse);
  }

  private async _assertConfigExists(key: string): Promise<void> {
    const config = await prisma.system_Config.findUnique({
      where: { key },
      select: { id: true },
    });

    if (!config) throw AppError.notFound('System config');
  }
}

export const systemConfigService = new SystemConfigService();
