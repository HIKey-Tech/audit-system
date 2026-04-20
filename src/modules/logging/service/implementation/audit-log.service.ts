// src/modules/logging/service/implementation/audit-log.service.ts
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import {
  IAuditLogService,
  CreateAuditLogDto,
} from '../interface/audit-log.service.interface';

export class AuditLogService implements IAuditLogService {
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      await prisma.audit_Log.create({
        data: {
          user_id: dto.userId ?? null,
          action: dto.action,
          module: dto.module,
          entity_type: dto.entityType ?? null,
          entity_id: dto.entityId ?? null,
          old_values: dto.oldValues ? JSON.stringify(dto.oldValues) : null,
          new_values: dto.newValues ? JSON.stringify(dto.newValues) : null,
          ip_address: dto.ipAddress ?? null,
          user_agent: dto.userAgent ?? null,
          status: dto.status ?? 'success',
          error_message: dto.errorMessage ?? null,
          duration_ms: dto.durationMs ?? null,
        },
      });
    } catch (err) {
      // Logging must never crash the application
      logger.error('Failed to persist audit log', { err, dto });
    }
  }

  logAsync(dto: CreateAuditLogDto): void {
    // Fire-and-forget — do not await
    this.log(dto).catch((err) =>
      logger.error('Async audit log failed', { err }),
    );
  }
}

// Singleton for use across the application
export const auditLogService = new AuditLogService();
