import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { auditLogService } from '../../../logging/service/implementation/audit-log.service';
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
    const before = await prisma.system_Config.findUnique({ where: { key }, select: { value: true } });
    if (!before) throw AppError.notFound('System config');

    const config = await prisma.system_Config.update({
      where: { key },
      data: {
        value,
        updated_by_id: updatedBy,
      },
    });

    logger.info('System config updated', { key, actorId: updatedBy });
    this._auditThresholdChange(key, before.value, config.value, updatedBy);
    return mapSystemConfigToResponse(config);
  }

  async bulkUpdateConfig(
    dto: BulkUpdateSystemConfigRequestDto,
    updatedBy: string,
  ): Promise<SystemConfigResponseDto[]> {
    const keys = dto.configs.map((config) => config.key);
    const existing = await prisma.system_Config.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
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
    const previous = new Map(existing.map((c) => [c.key, c.value]));
    for (const c of dto.configs) {
      this._auditThresholdChange(c.key, previous.get(c.key) ?? null, c.value ?? null, updatedBy);
    }

    const configs = await prisma.system_Config.findMany({
      where: { key: { in: keys } },
      orderBy: { key: 'asc' },
    });
    return configs.map(mapSystemConfigToResponse);
  }

  /**
   * The Dynafin report thresholds must be changeable by authorised users with every change
   * on the audit trail (reporting spec §6.6). The generic request log says who called which
   * endpoint; this adds the old and new value. Other keys are left exactly as they were.
   */
  private _auditThresholdChange(key: string, oldValue: string | null, newValue: string | null, actorId: string): void {
    if (!key.startsWith('dynafin.') || oldValue === newValue) return;
    auditLogService.logAsync({
      userId: actorId,
      action: 'settings.config.update',
      module: 'settings',
      entityType: 'system_config',
      entityId: key,
      oldValues: { value: oldValue },
      newValues: { value: newValue },
    });
  }
}

export const systemConfigService = new SystemConfigService();
