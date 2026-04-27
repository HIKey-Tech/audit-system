import { Router } from 'express';
import { IMonitoringService } from '../service/interface/monitoring.service.interface';
export declare class MonitoringController {
    private readonly monitoringService;
    readonly router: Router;
    constructor(monitoringService: IMonitoringService);
    private _registerRoutes;
    private _getHighRiskItems;
    private _getRisksRequiringAttention;
    private _getRiskScoreTrend;
    private _getOrganizationRiskSummary;
}
//# sourceMappingURL=monitoring.controller.d.ts.map