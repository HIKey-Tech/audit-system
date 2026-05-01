import { Router } from 'express';
import { IAuditLogService } from '../service/interface/audit-log.service.interface';
export declare class LoggingController {
    private readonly auditLogService;
    readonly router: Router;
    constructor(auditLogService: IAuditLogService);
    private _registerRoutes;
    private _listLogs;
    private _getLogById;
    private _getDistinctModules;
    private _getLogSummary;
}
//# sourceMappingURL=logging.controller.d.ts.map