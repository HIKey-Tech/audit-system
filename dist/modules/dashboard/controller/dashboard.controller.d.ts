import { Router } from 'express';
import { DashboardService } from '../service/implementation/dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    readonly router: Router;
    constructor(dashboardService: DashboardService);
    private _registerRoutes;
    private _getAuditSummary;
    private _getFindingsSummary;
    private _getRiskOverview;
    private _getRecentActivity;
    private _getEscalationOverview;
    private _getMyWork;
    private _getApprovalInboxSummary;
    private _getAuditAnalytics;
}
//# sourceMappingURL=dashboard.controller.d.ts.map