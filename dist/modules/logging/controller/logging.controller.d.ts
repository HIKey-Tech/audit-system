import { Router } from 'express';
import { IAuditLogService, ISystemLogService } from '../service/interface/audit-log.service.interface';
export declare class LoggingController {
    private readonly auditLogService;
    private readonly systemLogService;
    readonly router: Router;
    constructor(auditLogService: IAuditLogService, systemLogService: ISystemLogService);
    private _registerRoutes;
    private _verifyChain;
    private _getSecuritySummary;
    private _listSystemLogs;
    private _getSystemLogById;
    private _exportLogs;
    private _listLogs;
    private _getLogById;
    private _getDistinctModules;
    private _getLogSummary;
}
//# sourceMappingURL=logging.controller.d.ts.map