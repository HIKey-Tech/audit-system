import { Router } from 'express';
export declare const createLoggingModule: () => Router;
export { AuditLogService, auditLogService, } from './service/implementation/audit-log.service';
export { SystemLogService, systemLogService } from './service/implementation/system-log.service';
export type { IAuditLogService, ISystemLogService } from './service/interface/audit-log.service.interface';
export { SystemLogTransport } from './utility/system-log.transport';
export { logSecurityEvent } from './utility/security-event.utility';
export { SecurityEvent, SECURITY_LOG_MODULE } from './domain/enum/logging.enum';
//# sourceMappingURL=index.d.ts.map