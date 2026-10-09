import { Router } from 'express';
import { IContinuousMonitoringService } from '../service/interface/monitoring.service.interface';
export declare class ContinuousMonitoringController {
    private readonly monitoringService;
    readonly router: Router;
    constructor(monitoringService: IContinuousMonitoringService);
    private _registerRoutes;
    private _getDashboard;
    private _runNow;
}
//# sourceMappingURL=monitoring.controller.d.ts.map