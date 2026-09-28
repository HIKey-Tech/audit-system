// src/modules/logging/index.ts
import { Router } from 'express';
import { LoggingController } from './controller/logging.controller';
import { auditLogService } from './service/implementation/audit-log.service';
import { systemLogService } from './service/implementation/system-log.service';

export const createLoggingModule = (): Router => {
  const router = Router();

  // Controllers
  const loggingController = new LoggingController(auditLogService, systemLogService);

  // Mount
  router.use('/logs', loggingController.router);

  return router;
};

// Re-export for use in other modules
export {
  AuditLogService,
  auditLogService,
} from './service/implementation/audit-log.service';
export { SystemLogService, systemLogService } from './service/implementation/system-log.service';
export type { IAuditLogService, ISystemLogService } from './service/interface/audit-log.service.interface';
export { SystemLogTransport } from './utility/system-log.transport';
export { logSecurityEvent } from './utility/security-event.utility';
export { SecurityEvent, SECURITY_LOG_MODULE } from './domain/enum/logging.enum';
