// src/modules/logging/index.ts
import { Router } from 'express';
import { LoggingController } from './controller/logging.controller';
import { auditLogService } from './service/implementation/audit-log.service';

export const createLoggingModule = (): Router => {
  const router = Router();

  // Controllers
  const loggingController = new LoggingController(auditLogService);

  // Mount
  router.use('/logs', loggingController.router);

  return router;
};

// Re-export for use in other modules
export {
  AuditLogService,
  auditLogService,
} from './service/implementation/audit-log.service';
export type { IAuditLogService } from './service/interface/audit-log.service.interface';
