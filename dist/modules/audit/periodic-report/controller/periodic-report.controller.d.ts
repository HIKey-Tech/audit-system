import { Router } from 'express';
import { PeriodicReportService } from '../service/periodic-report.service';
export declare class PeriodicReportController {
    private readonly periodicReportService;
    readonly router: Router;
    constructor(periodicReportService?: PeriodicReportService);
    private _registerRoutes;
    private _getPeriodicReport;
    private _exportPeriodicReport;
}
//# sourceMappingURL=periodic-report.controller.d.ts.map