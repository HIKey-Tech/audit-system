import { IAuditLogService, CreateAuditLogDto } from '../interface/audit-log.service.interface';
export declare class AuditLogService implements IAuditLogService {
    log(dto: CreateAuditLogDto): Promise<void>;
    logAsync(dto: CreateAuditLogDto): void;
}
export declare const auditLogService: AuditLogService;
//# sourceMappingURL=audit-log.service.d.ts.map